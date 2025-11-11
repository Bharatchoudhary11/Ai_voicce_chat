# Supervisor Console Frontend

This lightweight SPA powers the human-in-the-loop workflow. It is intentionally backend-agnostic so it can talk to either the simulated APIs (stored locally for now) or a LiveKit-driven backend once it is ready.

## Project layout
```
frontend/
  index.html            # static entry point that loads the SPA
  src/
    app.js             # bootstraps the dashboard and wires components
    store.js           # minimal state container + pub/sub helpers
    api/mockApi.js     # temporary in-memory API used until backend lands
    components/
      RequestList.js
      RequestDetails.js
      KnowledgeBaseView.js
      ActivityLog.js
    styles.css         # utility + layout styles for the dashboard
```

## Data model
- **HelpRequest**: `{ id, customerName, channel, question, status, createdAt, escalatedAt, resolvedAt, resolutionNotes, answer, tags, history[] }`
- **SupervisorResponse**: `{ requestId, answer, confidence, respondedAt, unresolved }`
- **KnowledgeBaseEntry**: `{ id, topic, question, answer, updatedAt, sourceRequestId }`

Statuses flow `pending -> resolved | unresolved`.

## Backend contract (planned)
The frontend assumes the following REST-ish endpoints (easy to swap out later):
- `GET /api/help-requests?status=pending`
- `GET /api/help-requests/:id`
- `POST /api/help-requests/:id/response`
- `POST /api/help-requests/:id/timeout`
- `GET /api/knowledge-base`

These requests are issued via `src/api/mockApi.js`, which now proxies to the FastAPI backend. The base URL is taken from the global `window.__SUPERVISOR_API_BASE__` (set to `http://localhost:8000` by default in `index.html`). Override it before loading the app if your backend lives elsewhere, e.g.:

```html
<script>
  window.__SUPERVISOR_API_BASE__ = "https://staging.your-domain.com";
</script>
```

### Seeding data
Create escalated tickets from the command line while the backend is running:

```bash
curl -X POST http://localhost:8000/api/help-requests \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Alex","channel":"phone","question":"Do you do bridal trials?","customer_contact":"sms:+155555501"}'
```

Each response you submit via the dashboard will automatically text the simulated customer and add a knowledge-base entry.
