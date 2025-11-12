from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from datetime import datetime, timedelta

from app.services.help_requests import HelpRequestService
from app.services.notifications import NotificationPayload, NotificationSink


class DummyNotifier(NotificationSink):
    def __init__(self) -> None:
        self.customer_notifications: list[NotificationPayload] = []
        self.supervisor_notifications: list[NotificationPayload] = []

    def notify_supervisor(self, payload: NotificationPayload) -> None:
        self.supervisor_notifications.append(payload)

    def notify_customer(self, payload: NotificationPayload) -> None:
        self.customer_notifications.append(payload)


def _session():
    engine = create_engine("sqlite+pysqlite:///:memory:", echo=False, future=True)
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, future=True)()


def test_escalation_to_resolution():
    session = _session()
    notifier = DummyNotifier()
    service = HelpRequestService(session, notifier=notifier)

    request = service.create_escalation(
        customer_name="Alex",
        question="Do you offer balayage for short hair?",
        channel="phone",
        customer_contact="sms:+1555010",
    )
    assert request.status == "pending"

    updated, kb_entry = service.record_response(
        request_id=request.id,
        answer="Yes! Balayage for short hair starts at $180.",
        topic="Services",
        unresolved=False,
        notes="",
    )

    assert updated.status == "resolved"
    assert kb_entry is not None
    assert kb_entry.topic == "Services"
    assert updated.follow_up_at is None
    assert updated.follow_up_reminder_sent is False
    assert any(
        "I've got your question" in notification.message
        for notification in notifier.customer_notifications
    )

    kb_list = service.list_knowledge_base()
    assert len(kb_list) == 1
    assert kb_list[0].question == request.question


def test_unresolved_response_schedules_follow_up():
    session = _session()
    notifier = DummyNotifier()
    service = HelpRequestService(session, notifier=notifier)

    request = service.create_escalation(
        customer_name="Jamie",
        question="Can I push my appointment to next Monday?",
        channel="sms",
        customer_contact="sms:+1555999",
    )

    updated, kb_entry = service.record_response(
        request_id=request.id,
        answer="I'm still checking availability for you.",
        topic="Scheduling",
        unresolved=True,
        notes="Need manager approval.",
        follow_up_minutes=45,
    )

    assert kb_entry is None
    assert updated.status == "unresolved"
    assert updated.follow_up_at is not None
    assert updated.follow_up_reminder_sent is False
    last_message = notifier.customer_notifications[-1].message
    assert "45 minutes" in last_message
    follow_up_delta = updated.follow_up_at - datetime.utcnow()
    assert timedelta(minutes=40) < follow_up_delta <= timedelta(minutes=46)


def test_follow_up_reminder_dispatch():
    session = _session()
    notifier = DummyNotifier()
    service = HelpRequestService(session, notifier=notifier)

    request = service.create_escalation(
        customer_name="Taylor",
        question="Do you have evening slots?",
        channel="sms",
        customer_contact="sms:+1555777",
    )

    updated, _ = service.record_response(
        request_id=request.id,
        answer="Working on it.",
        topic="Scheduling",
        unresolved=True,
        notes="",
        follow_up_minutes=15,
    )

    orm = service.repo.get(updated.id)
    assert orm is not None
    orm.follow_up_at = datetime.utcnow() - timedelta(minutes=5)
    orm.follow_up_reminder_sent = False
    service.repo.session.add(orm)
    service.repo.session.flush()

    sent = service.send_due_follow_up_reminders(now=datetime.utcnow())

    assert sent == 1
    refreshed = service.get_request(updated.id)
    assert refreshed.follow_up_reminder_sent is True
    assert any(
        "Thanks for your patience" in message.message
        for message in notifier.customer_notifications
    )

