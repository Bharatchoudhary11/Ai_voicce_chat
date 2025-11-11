from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from ..models import HistoryEntry, RequestStatus


class HelpRequestCreate(BaseModel):
    customer_name: str
    channel: str
    question: str
    customer_contact: Optional[str] = None


class SupervisorResponseCreate(BaseModel):
    answer: str
    topic: Optional[str] = None
    unresolved: bool = False
    notes: Optional[str] = None


class HelpRequestView(BaseModel):
    id: str
    customer_name: str
    customer_contact: Optional[str]
    channel: str
    question: str
    status: RequestStatus
    answer: Optional[str]
    notes: Optional[str]
    created_at: datetime
    escalated_at: datetime
    resolved_at: Optional[datetime]
    history: List[HistoryEntry]

    class Config:
        from_attributes = True


class KnowledgeBaseEntryView(BaseModel):
    id: int
    source_request_id: str
    topic: str
    question: str
    answer: str
    updated_at: datetime

    class Config:
        from_attributes = True
