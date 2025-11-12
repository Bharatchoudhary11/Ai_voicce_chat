import { subscribe, setState, getState } from "./store.js";
import {
  fetchRequests,
  fetchKnowledgeBase,
  submitResponse,
  markTimeout,
} from "./api/mockApi.js";
import { renderRequestList } from "./components/RequestList.js";
import { renderRequestDetails } from "./components/RequestDetails.js";
import { renderKnowledgeBase } from "./components/KnowledgeBaseView.js";
import { renderActivityLog } from "./components/ActivityLog.js";

const appEl = document.getElementById("app");

async function bootstrap() {
  try {
    const [requestPayload, kbPayload] = await Promise.all([
      fetchRequests(),
      fetchKnowledgeBase(),
    ]);
    const requests = requestPayload.map(mapHelpRequest);
    const knowledgeBase = kbPayload.map(mapKnowledgeBaseEntry);
    setState({
      requests,
      knowledgeBase,
      selectedRequestId: requests[0]?.id ?? null,
      activityLog: buildInitialActivityLog(requests),
      appReady: true,
    });
  } catch (err) {
    console.error("Failed to bootstrap app", err);
    appEl.innerHTML =
      '<main class="empty-state">Failed to load supervisor console.</main>';
  }
}

subscribe("root", (state) => {
  if (!state.appReady) {
    appEl.innerHTML =
      '<main class="empty-state">Loading supervisor console...</main>';
    return;
  }

  appEl.innerHTML = `
    <main class="layout">
      <section class="panel">
        <header>
          <h2>Pending Requests</h2>
        </header>
        <div class="panel-body" id="request-list"></div>
      </section>
      <section class="panel">
        <header>
          <h2>Request Details</h2>
        </header>
        <div class="panel-body" id="request-details"></div>
      </section>
      <section class="panel">
        <header>
          <h2>Knowledge Base</h2>
        </header>
        <div class="panel-body" id="knowledge-base"></div>
        <div class="panel-footer" id="activity-log"></div>
      </section>
    </main>
  `;
  renderRequestList(document.getElementById("request-list"), state, {
    onSelect: (id) => setState({ selectedRequestId: id }),
  });
  renderRequestDetails(document.getElementById("request-details"), state, {
    onRespond: handleSupervisorResponse,
    onTimeout: handleTimeout,
  });
  renderKnowledgeBase(document.getElementById("knowledge-base"), state);
  renderActivityLog(document.getElementById("activity-log"), state);
});

async function handleSupervisorResponse(payload) {
  const requestId = getState().selectedRequestId;
  if (!requestId) return;
  setState({ isSaving: true });
  try {
    const { followUpMinutes, ...restPayload } = payload;
    const apiPayload = {
      answer: restPayload.answer,
      topic: restPayload.topic,
      unresolved: restPayload.unresolved,
      notes: restPayload.notes,
    };
    if (restPayload.unresolved) {
      apiPayload.follow_up_minutes = followUpMinutes ?? null;
    }
    const updatedRequest = mapHelpRequest(
      await submitResponse(requestId, apiPayload)
    );
    await refreshData({ selectedRequestId: updatedRequest.id, isSaving: false });
    if (restPayload.unresolved) {
      const minutesCopy = followUpMinutes ?? null;
      const followUpSummary = minutesCopy
        ? `${minutesCopy} minute${minutesCopy === 1 ? "" : "s"}`
        : "a little while";
      pushActivity(
        `Requested follow-up from ${updatedRequest.customerName} (${updatedRequest.id}) within ${followUpSummary}.`,
        "warn"
      );
    } else {
      pushActivity(
        `Supervisor responded to ${updatedRequest.customerName} (${updatedRequest.id}).`,
        "success"
      );
    }
    console.log(
      `[AI -> ${updatedRequest.customerName}] Sending answer: ${payload.answer}`
    );
  } catch (err) {
    console.error("Failed to submit response", err);
    pushActivity(`Failed to submit response: ${err.message}`, "error");
    setState({ isSaving: false });
  }
}

async function handleTimeout() {
  const requestId = getState().selectedRequestId;
  if (!requestId) return;
  setState({ isSaving: true });
  try {
    const updatedRequest = mapHelpRequest(await markTimeout(requestId));
    await refreshData({ selectedRequestId: updatedRequest.id, isSaving: false });
    pushActivity(`Marked ${updatedRequest.id} as unresolved after timeout.`, "warn");
    console.log(
      `[AI -> ${updatedRequest.customerName}] Let me check with my supervisor... still waiting.`
    );
  } catch (err) {
    console.error("Failed to mark timeout", err);
    pushActivity(`Failed to mark timeout: ${err.message}`, "error");
    setState({ isSaving: false });
  }
}

async function refreshData(partialState = {}) {
  const [requestPayload, kbPayload] = await Promise.all([
    fetchRequests(),
    fetchKnowledgeBase(),
  ]);
  setState({
    requests: requestPayload.map(mapHelpRequest),
    knowledgeBase: kbPayload.map(mapKnowledgeBaseEntry),
    ...partialState,
  });
}

function buildInitialActivityLog(requests) {
  return requests
    .map((req) => ({
      id: `seed-${req.id}`,
      message: `${req.customerName} escalated a ${req.channel} question (${req.id}).`,
      timestamp: req.escalatedAt ?? req.createdAt,
      tone: "info",
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function pushActivity(message, tone = "info") {
  const current = getState().activityLog ?? [];
  const entry = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `log-${Date.now()}-${Math.random()}`,
    message,
    timestamp: new Date().toISOString(),
    tone,
  };
  setState({ activityLog: [entry, ...current].slice(0, 50) });
}

function mapHelpRequest(raw) {
  return {
    id: raw.id,
    customerName: raw.customer_name ?? raw.customerName ?? "Unknown",
    customerContact: raw.customer_contact ?? raw.customerContact ?? null,
    channel: raw.channel,
    question: raw.question,
    status: raw.status,
    answer: raw.answer,
    notes: raw.notes,
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    escalatedAt: raw.escalated_at ?? raw.escalatedAt ?? raw.created_at ?? raw.createdAt,
    resolvedAt: raw.resolved_at ?? raw.resolvedAt ?? null,
    history: (raw.history || []).map((entry) => {
      const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();
      const safeTimestamp = Number.isNaN(ts.getTime()) ? new Date() : ts;
      return {
        timestamp: safeTimestamp.toISOString(),
        message: entry.message,
      };
    }),
    followUpAt: raw.follow_up_at ?? raw.followUpAt ?? null,
    followUpReminderSent:
      raw.follow_up_reminder_sent ?? raw.followUpReminderSent ?? false,
  };
}

function mapKnowledgeBaseEntry(raw) {
  return {
    id: raw.id,
    sourceRequestId: raw.source_request_id ?? raw.sourceRequestId,
    topic: raw.topic,
    question: raw.question,
    answer: raw.answer,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
  };
}

bootstrap();
