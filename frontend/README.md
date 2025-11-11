# Supervisor Console Frontend

This lightweight SPA powers the human-in-the-loop workflow. It is intentionally backend-agnostic so it can talk to either the simulated APIs (stored locally for now) or a LiveKit-driven backend once it is ready.

## Project layout
```
frontend/
  index.html            # static entry point that loads the SPA
  src/
    app.js             # bootstraps the dashboard and wires components
    store.js           # minimal state container + pub/sub helpers
    api/mockApi.js     # swappable data layer (mocked for now, live-ready later)
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

By default the dashboard boots in **mock** mode so you can explore the workflow without a backend. Mock data is seeded on first load and then saved to `localStorage`, so you can refresh and keep working through a realistic queue of escalations.

When the backend is ready flip the runtime global before the script tag in `index.html`:

```html
<script>
  window.__SUPERVISOR_API_MODE__ = "live"; // or set via your bundler
  window.__SUPERVISOR_API_BASE__ = "http://localhost:8000"; // FastAPI default
</script>
```

In `live` mode the frontend calls the REST endpoints described above. Leaving `window.__SUPERVISOR_API_MODE__` unset (or explicitly `mock`) keeps everything in-memory.

If the backend lives elsewhere, override `window.__SUPERVISOR_API_BASE__` with the appropriate host before the SPA loads, e.g.:

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

Each response you submit via the dashboard will automatically text the simulated customer and add a knowledge-base entry. In mock mode the "texts" and lifecycle updates happen inside the app state; once connected to the backend the same calls will hit the LiveKit-driven service.
