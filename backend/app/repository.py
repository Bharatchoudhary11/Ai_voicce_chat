from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Base, engine
from .models import (
    HelpRequestORM,
    KnowledgeBaseEntryORM,
    RequestStatus,
    SupervisorResponseORM,
    append_history,
)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


class HelpRequestRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self, status: Optional[RequestStatus] = None) -> Iterable[HelpRequestORM]:
        stmt = select(HelpRequestORM).order_by(HelpRequestORM.created_at.desc())
        if status:
            stmt = stmt.where(HelpRequestORM.status == status.value)
        return self.session.scalars(stmt).all()

    def get(self, request_id: str) -> Optional[HelpRequestORM]:
        return self.session.get(HelpRequestORM, request_id)

    def create(
        self,
        *,
        customer_name: str,
        channel: str,
        question: str,
        customer_contact: Optional[str] = None,
        history_message: Optional[str] = None,
    ) -> HelpRequestORM:
        history = []
        if history_message:
            history = append_history(history, history_message)
        request = HelpRequestORM(
            customer_name=customer_name,
            channel=channel,
            customer_contact=customer_contact,
            question=question,
            history=history,
        )
        self.session.add(request)
        self.session.flush()
        return request

    def add_history(self, request: HelpRequestORM, message: str) -> None:
        request.history = append_history(request.history, message)
        self.session.add(request)

    def mark_timeout(self, request: HelpRequestORM) -> HelpRequestORM:
        request.status = RequestStatus.unresolved.value
        request.resolved_at = datetime.utcnow()
        self.add_history(request, "Marked unresolved after timeout.")
        return request

    def attach_response(
        self,
        request: HelpRequestORM,
        *,
        answer: str,
        topic: str,
        unresolved: bool,
        notes: Optional[str],
    ) -> SupervisorResponseORM:
        response = SupervisorResponseORM(
            request_id=request.id,
            answer=answer,
            topic=topic,
            unresolved=unresolved,
            notes=notes,
        )
        request.status = (
            RequestStatus.unresolved.value if unresolved else RequestStatus.resolved.value
        )
        request.answer = answer
        request.notes = notes
        request.resolved_at = request.resolved_at or response.created_at
        self.add_history(request, f"Supervisor responded: {answer}")
        self.session.add(response)
        self.session.flush()
        return response

    def schedule_follow_up(self, request: HelpRequestORM, follow_up_at: datetime) -> None:
        request.follow_up_at = follow_up_at
        request.follow_up_reminder_sent = False
        self.add_history(
            request,
            f"Follow-up reminder scheduled for {follow_up_at.isoformat()}.",
        )

    def clear_follow_up(self, request: HelpRequestORM) -> None:
        request.follow_up_at = None
        request.follow_up_reminder_sent = False
        self.session.add(request)

    def list_due_followups(self, current_time: datetime) -> Iterable[HelpRequestORM]:
        stmt = (
            select(HelpRequestORM)
            .where(
                HelpRequestORM.status == RequestStatus.unresolved.value,
                HelpRequestORM.follow_up_at.is_not(None),
                HelpRequestORM.follow_up_reminder_sent.is_(False),
                HelpRequestORM.follow_up_at <= current_time,
            )
            .order_by(HelpRequestORM.follow_up_at.asc())
        )
        return self.session.scalars(stmt).all()

    def mark_follow_up_reminder_sent(self, request: HelpRequestORM) -> None:
        request.follow_up_reminder_sent = True
        self.session.add(request)


class KnowledgeBaseRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> Iterable[KnowledgeBaseEntryORM]:
        stmt = select(KnowledgeBaseEntryORM).order_by(
            KnowledgeBaseEntryORM.updated_at.desc()
        )
        return self.session.scalars(stmt).all()

    def create_from_response(
        self,
        *,
        request: HelpRequestORM,
        response: SupervisorResponseORM,
    ) -> KnowledgeBaseEntryORM:
        entry = KnowledgeBaseEntryORM(
            source_request_id=request.id,
            topic=response.topic,
            question=request.question,
            answer=response.answer,
        )
        self.session.add(entry)
        self.session.flush()
        return entry
