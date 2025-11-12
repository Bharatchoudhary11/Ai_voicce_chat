from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import RequestStatus
from ..services.help_requests import HelpRequestService
from .schemas import (
    HelpRequestCreate,
    HelpRequestView,
    KnowledgeBaseEntryView,
    SupervisorResponseCreate,
)

router = APIRouter(prefix="/api", tags=["help-requests"])


def _service(session: Session) -> HelpRequestService:
    return HelpRequestService(session=session)


@router.get("/help-requests", response_model=list[HelpRequestView])
def list_help_requests(
    status: RequestStatus | None = None,
    db: Session = Depends(get_db),
):
    service = _service(db)
    return service.list_requests(status=status)


@router.get("/help-requests/{request_id}", response_model=HelpRequestView)
def get_help_request(request_id: str, db: Session = Depends(get_db)):
    service = _service(db)
    try:
        return service.get_request(request_id)
    except ValueError as exc:  # pragma: no cover - FastAPI handles
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/help-requests", response_model=HelpRequestView, status_code=status.HTTP_201_CREATED)
def create_help_request(payload: HelpRequestCreate, db: Session = Depends(get_db)):
    service = _service(db)
    return service.create_escalation(**payload.dict())


@router.post(
    "/help-requests/{request_id}/response",
    response_model=HelpRequestView,
)
def submit_response(
    request_id: str,
    payload: SupervisorResponseCreate,
    db: Session = Depends(get_db),
):
    service = _service(db)
    try:
        updated, kb_entry = service.record_response(
            request_id,
            **payload.dict(),
        )
    except ValueError as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return updated


@router.post("/help-requests/{request_id}/timeout", response_model=HelpRequestView)
def timeout_request(
    request_id: str,
    follow_up_minutes: int | None = None,
    db: Session = Depends(get_db),
):
    service = _service(db)
    try:
        return service.mark_timeout(request_id, follow_up_minutes=follow_up_minutes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/knowledge-base", response_model=list[KnowledgeBaseEntryView])
def list_knowledge_base(db: Session = Depends(get_db)):
    service = _service(db)
    return service.list_knowledge_base()


@router.post("/help-requests/follow-ups/dispatch")
def dispatch_follow_ups(db: Session = Depends(get_db)) -> dict[str, int]:
    service = _service(db)
    sent = service.send_due_follow_up_reminders()
    return {"sent": sent}
