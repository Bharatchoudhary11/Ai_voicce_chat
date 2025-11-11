from __future__ import annotations

from pathlib import Path
from typing import Optional

from ..config import get_settings
from ..db import db_session
from ..models import KnowledgeBaseEntry
from .help_requests import HelpRequestService

PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "salon_profile.md"


class LiveKitAgentBridge:
    """Shim that would connect to the LiveKit Python SDK.

    In this skeleton we only simulate the business logic and leave the actual socket
    connections for later. The methods here are still useful for unit tests: they
    attempt to answer based on the knowledge base and escalate when stuck.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        if PROMPT_PATH.exists():
            self.system_prompt = PROMPT_PATH.read_text(encoding="utf-8")
        else:  # pragma: no cover
            self.system_prompt = "You are a helpful salon receptionist."

    def handle_customer_question(
        self,
        *,
        customer_name: str,
        channel: str,
        question: str,
        customer_contact: Optional[str] = None,
    ) -> Optional[str]:
        """Return an answer if found, otherwise escalate."""

        kb_entries = self._fetch_kb()
        answer = self._match_answer(kb_entries, question)
        if answer:
            print(f"[AI -> {customer_name}] {answer}")
            return answer

        with db_session() as session:
            service = HelpRequestService(session)
            service.create_escalation(
                customer_name=customer_name,
                question=question,
                channel=channel,
                customer_contact=customer_contact,
            )
        return None

    def _fetch_kb(self) -> list[KnowledgeBaseEntry]:
        with db_session() as session:
            service = HelpRequestService(session)
            return service.list_knowledge_base()

    @staticmethod
    def _match_answer(entries: list[KnowledgeBaseEntry], question: str) -> Optional[str]:
        if not entries:
            return None
        q_lower = question.lower()
        for entry in entries:
            if entry.question.lower() in q_lower or q_lower in entry.question.lower():
                return entry.answer
        return None
