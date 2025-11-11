from __future__ import annotations

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

        self.notifier.notify_customer(
            NotificationPayload(
                recipient=orm.customer_name,
                channel=orm.channel,
                message=answer,
            )
        )

        return HelpRequest.model_validate(orm), kb_entry

    def mark_timeout(self, request_id: str) -> HelpRequest:
        orm = self.repo.get(request_id)
        if not orm:
            raise ValueError(f"Request {request_id} not found")
        self.repo.mark_timeout(orm)
        self.notifier.notify_customer(
            NotificationPayload(
                recipient=orm.customer_name,
                channel=orm.channel,
                message="Let me check with my supervisor and get back to you.",
            )
        )
        return HelpRequest.model_validate(orm)

    def list_knowledge_base(self) -> list[KnowledgeBaseEntry]:
        entries = self.kb_repo.list()
        return [KnowledgeBaseEntry.model_validate(item) for item in entries]
