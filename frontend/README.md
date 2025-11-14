# Supervisor Console Frontend

This lightweight SPA powers the human-in-the-loop workflow. It is intentionally backend-agnostic so it can talk to either the simulated APIs (stored locally for now) or a LiveKit-driven backend once it is ready.

## Project layout
```
frontend/
  index.html            # static entry point that loads the SPA
  src/
    app.js             # bootstraps the dashboard and wires components
    store.js           # minimal state container + pub/sub helpers
    api/client.js      # swappable data layer (mock + live REST client)
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

### API modes

By default the dashboard boots in **live** mode so every action hits the FastAPI backend immediately. Toggle the mode once (query string below) and it will stick in `localStorage` for future visits.

To force a mode explicitly, append a query string when you load the dashboard (e.g. `http://localhost:5173/?mode=mock`). You can also persist a custom API host via `?apiBase=https://staging.example.com`. These values are cached locally, so once you set them you can remove the query parameters on subsequent visits.

If you are bundling the frontend elsewhere you can still set the globals manually before the script loads:

```html
<script>
  window.__SUPERVISOR_API_MODE__ = "mock"; // or "live"
  window.__SUPERVISOR_API_BASE__ = "http://localhost:8000"; // FastAPI default
</script>
```

### Seeding data
Create escalated tickets from the command line while the backend is running:

```bash
curl -X POST http://localhost:8000/api/help-requests \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Alex","channel":"phone","question":"Do you do bridal trials?","customer_contact":"sms:+155555501"}'
```

Each response you submit via the dashboard will automatically text the simulated customer and add a knowledge-base entry. In mock mode the "texts" and lifecycle updates happen inside the app state; once connected to the backend the same calls will hit the LiveKit-driven service.
