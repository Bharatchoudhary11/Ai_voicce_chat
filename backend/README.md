# Human-in-the-loop Backend

Python service that coordinates the LiveKit agent, escalations, supervisor responses, and the knowledge base that feeds future conversations.

## Architecture at a glance

```
backend/
  app/
    main.py            # FastAPI entry point, mounts routers and background tasks
    config.py          # env-driven settings (db path, timeouts, LiveKit keys)
    db.py              # lightweight SQLite wrapper + migrations
    models.py          # domain models shared across layers
    repository.py      # persistence helpers for requests/responses/kb entries
    services/
      help_requests.py # lifecycle orchestration + knowledge base writes
      notifications.py # pluggable sinks for supervisor/customer pings
      livekit_agent.py # LiveKit agent shim, escalates unknown answers
    api/
      router.py        # REST endpoints consumed by the frontend
      schemas.py       # Pydantic request/response payloads
    livekit_worker.py  # Runnable worker that plugs into livekit.agents
  prompts/
    salon_profile.md   # System prompt describing the fictional salon
```

### Data model
- **HelpRequest**: `id`, `customer_name`, `channel`, `question`, `status`, timestamps, `answer`, `notes`, `customer_contact`, `history_json`
- **SupervisorResponse**: `id`, `request_id`, `answer`, `topic`, `unresolved`, `notes`, `created_at`
- **KnowledgeBaseEntry**: `id`, `question`, `answer`, `topic`, `source_request_id`, `updated_at`

Statuses flow `pending -> resolved | unresolved`. Timeouts move pending tickets to `unresolved`.

### API surface (mirrors frontend contract)
- `GET /health`
- `GET /api/help-requests?status=`
- `GET /api/help-requests/{id}`
- `POST /api/help-requests` (allow LiveKit agent or tests to create new escalations)
- `POST /api/help-requests/{id}/response`
- `POST /api/help-requests/{id}/timeout`
- `GET /api/knowledge-base`

Every supervisor response updates the KB (unless `unresolved`) and triggers an async notification hook so the AI “texts” the customer immediately.

### LiveKit integration plan
1. `LiveKitAgent` boots via `livekit.agents` SDK with the salon profile prompt.
2. When `on_participant_joined` fires, the agent tries to answer using the KB.
3. Unknown questions fall back to `HelpRequestService.create_escalation`, which logs the caller’s question and simulates a “request help” event.
4. When supervisors respond through the UI, the backend calls `LiveKitAgent.notify_customer(...)` (currently a console log / webhook placeholder) to text the caller.

Everything is modular so swapping the mock transport for real SMS or ticketing later is straightforward.

## Getting started

1. Install dependencies:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Export LiveKit creds (or keep the defaults for local simulation):
   ```bash
   export LIVEKIT_URL=wss://<your-instance>
   export LIVEKIT_API_KEY=...
   export LIVEKIT_API_SECRET=...
   ```
3. Run the API:
   ```bash
   uvicorn app.main:app --reload
   ```

The FastAPI docs will be at http://localhost:8000/docs. The frontend defaults to `http://localhost:8000`; adjust `Settings.allowed_origins` (or set `ALLOWED_ORIGINS='["https://your-ui"]'` in your env) if you need to serve from a different origin.

### Tests

Run the lightweight unit test that exercises the request lifecycle:

```bash
cd backend
pytest
```
