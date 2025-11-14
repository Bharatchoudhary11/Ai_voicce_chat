from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import HelpRequest, KnowledgeBaseEntry, RequestStatus
from ..repository import HelpRequestRepository, KnowledgeBaseRepository
from .notifications import NotificationPayload, NotificationSink, console_notifier


class HelpRequestService:
    def __init__(
        self,
        session: Session,
        notifier: NotificationSink = console_notifier,
    ) -> None:
        self.settings = get_settings()
        self.repo = HelpRequestRepository(session)
        self.kb_repo = KnowledgeBaseRepository(session)
        self.notifier = notifier

    def list_requests(
        self, *, status: Optional[RequestStatus] = None
    ) -> list[HelpRequest]:
        orm_items = self.repo.list(status)
        return [HelpRequest.model_validate(item) for item in orm_items]

    def get_request(self, request_id: str) -> HelpRequest:
        orm = self.repo.get(request_id)
        if not orm:
            raise ValueError(f"Request {request_id} not found")
        return HelpRequest.model_validate(orm)

    def create_escalation(
        self,
        *,
        customer_name: str,
        question: str,
        channel: str,
        customer_contact: Optional[str],
    ) -> HelpRequest:
        orm = self.repo.create(
            customer_name=customer_name,
            channel=channel,
            question=question,
            customer_contact=customer_contact,
            history_message="AI escalated to supervisor",
        )
        acknowledgement = (
            "Hi there! I've got your question and I'm looping in my supervisor "
            "so we can get you the right answer."
        )
        self.repo.add_history(orm, acknowledgement)
        self.notifier.notify_customer(
            NotificationPayload(
                recipient=customer_name,
                channel=channel,
                message=acknowledgement,
            )
        )
        self.notifier.notify_supervisor(
            NotificationPayload(
                recipient="Supervisor On-call",
                channel="console",
                message=f"Hey, I need help answering '{question}'.",
            )
        )
        return HelpRequest.model_validate(orm)

    def record_response(
        self,
        request_id: str,
        *,
        answer: str,
        topic: str,
        unresolved: bool,
        notes: Optional[str],
        follow_up_minutes: Optional[int] = None,
    ) -> Tuple[HelpRequest, Optional[KnowledgeBaseEntry]]:
        orm = self.repo.get(request_id)
        if not orm:
            raise ValueError(f"Request {request_id} not found")

        response = self.repo.attach_response(
            orm,
            answer=answer,
            topic=topic or self.settings.knowledge_base_auto_tag,
            unresolved=unresolved,
            notes=notes,
        )

        kb_entry = None
        if not unresolved:
            kb = self.kb_repo.create_from_response(request=orm, response=response)
            kb_entry = KnowledgeBaseEntry.model_validate(kb)
            self.repo.clear_follow_up(orm)
            message = answer
            closing = self.settings.post_resolution_followup.strip()
            if closing:
                closing_message = closing
                message = (
                    f"{(answer or '').strip()}".strip()
                    if answer and answer.strip()
                    else "I wanted to follow up on your request."
                )
                message = message.rstrip()
                if closing_message:
                    message = f"{message}\n\n{closing_message}"
                self.repo.add_history(
                    orm,
                    "Auto follow-up: sent reassurance message after resolution.",
                )
        else:
            minutes = self._normalize_follow_up_minutes(follow_up_minutes)
            follow_up_at = datetime.utcnow() + timedelta(minutes=minutes)
            self.repo.schedule_follow_up(orm, follow_up_at)
            base_answer = answer or "Thanks for staying with me while I gather more info."
            message = (
                f"{base_answer} I'll check back in about {minutes} minutes. "
                "Please feel free to reply with any updates in the meantime."
            )
            self.repo.add_history(
                orm,
                f"Asked customer for an update within {minutes} minutes.",
            )

        self.notifier.notify_customer(
            NotificationPayload(
                recipient=orm.customer_name,
                channel=orm.channel,
                message=message,
            )
        )

        return HelpRequest.model_validate(orm), kb_entry

    def mark_timeout(
        self, request_id: str, follow_up_minutes: Optional[int] = None
    ) -> HelpRequest:
        orm = self.repo.get(request_id)
        if not orm:
            raise ValueError(f"Request {request_id} not found")
        self.repo.mark_timeout(orm)
        minutes = self._normalize_follow_up_minutes(follow_up_minutes)
        follow_up_at = datetime.utcnow() + timedelta(minutes=minutes)
        self.repo.schedule_follow_up(orm, follow_up_at)
        self.repo.add_history(
            orm,
            f"Timeout occurred. Promised update in {minutes} minutes.",
        )
        self.notifier.notify_customer(
            NotificationPayload(
                recipient=orm.customer_name,
                channel=orm.channel,
                message=(
                    "Thanks for your patience. I'm still coordinating with my "
                    f"supervisor and will follow up in about {minutes} minutes."
                ),
            )
        )
        return HelpRequest.model_validate(orm)

    def list_knowledge_base(self) -> list[KnowledgeBaseEntry]:
        entries = self.kb_repo.list()
        return [KnowledgeBaseEntry.model_validate(item) for item in entries]

    def send_due_follow_up_reminders(
        self, *, now: Optional[datetime] = None
    ) -> int:
        current_time = now or datetime.utcnow()
        due_requests = self.repo.list_due_followups(current_time)
        count = 0
        for request in due_requests:
            reminder_message = (
                "Thanks for your patience — I'm still working on this and will "
                "update you as soon as I have news."
            )
            self.notifier.notify_customer(
                NotificationPayload(
                    recipient=request.customer_name,
                    channel=request.channel,
                    message=reminder_message,
                )
            )
            self.repo.add_history(
                request,
                "Automated reminder sent: still working, will follow up shortly.",
            )
            self.repo.mark_follow_up_reminder_sent(request)
            count += 1
        return count

    def _normalize_follow_up_minutes(self, value: Optional[int]) -> int:
        if value is None or value <= 0:
            return self.settings.request_timeout_minutes
        return value
