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

For now these methods are implemented inside `src/api/mockApi.js`. Replace that module with real `fetch` calls when the backend exists.
