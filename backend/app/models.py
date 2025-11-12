from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class RequestStatus(str, Enum):
    pending = "pending"
    resolved = "resolved"
    unresolved = "unresolved"


class HelpRequestORM(Base):
    __tablename__ = "help_requests"

    id: Mapped[str] = mapped_column(
        String(32), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_contact: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    channel: Mapped[str] = mapped_column(String(20))
    question: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default=RequestStatus.pending.value)
    answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    escalated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    history: Mapped[list] = mapped_column(SQLiteJSON, default=list)
    follow_up_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    follow_up_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    responses: Mapped[List["SupervisorResponseORM"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class SupervisorResponseORM(Base):
    __tablename__ = "supervisor_responses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("help_requests.id"))
    answer: Mapped[str] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(String(80), default="General")
    unresolved: Mapped[bool] = mapped_column(default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    request: Mapped[HelpRequestORM] = relationship(back_populates="responses")


class KnowledgeBaseEntryORM(Base):
    __tablename__ = "knowledge_base"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_request_id: Mapped[str] = mapped_column(String(32))
    topic: Mapped[str] = mapped_column(String(80))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# --------- Pydantic Schemas (shared) ---------


class HistoryEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message: str


class HelpRequest(BaseModel):
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
    history: List[HistoryEntry] = Field(default_factory=list)
    follow_up_at: Optional[datetime] = None
    follow_up_reminder_sent: bool = False

    class Config:
        from_attributes = True


class SupervisorResponse(BaseModel):
    id: int
    request_id: str
    answer: str
    topic: str
    unresolved: bool
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeBaseEntry(BaseModel):
    id: int
    source_request_id: str
    topic: str
    question: str
    answer: str
    updated_at: datetime

    class Config:
        from_attributes = True


def append_history(entry_list: list, message: str) -> list:
    entry_list = list(entry_list or [])
    entry_list.append({"timestamp": datetime.utcnow().isoformat(), "message": message})
    return entry_list
