from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.services.help_requests import HelpRequestService


def _session():
    engine = create_engine("sqlite+pysqlite:///:memory:", echo=False, future=True)
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, future=True)()


def test_escalation_to_resolution():
    session = _session()
    service = HelpRequestService(session)

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

    kb_list = service.list_knowledge_base()
    assert len(kb_list) == 1
    assert kb_list[0].question == request.question
