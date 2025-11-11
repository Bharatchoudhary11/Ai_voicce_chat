const MODE = (window.__SUPERVISOR_API_MODE__ || "mock").toLowerCase();
const DEFAULT_BASE_URL = "http://localhost:8000";
const API_BASE_URL = (window.__SUPERVISOR_API_BASE__ || DEFAULT_BASE_URL).replace(/\/$/, "");

function createNetworkApi() {
  async function http(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request to ${path} failed`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  return {
    fetchRequests(status) {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const query = params.toString() ? `?${params.toString()}` : "";
      return http(`/api/help-requests${query}`);
    },
    fetchKnowledgeBase() {
      return http("/api/knowledge-base");
    },
    submitResponse(requestId, payload) {
      return http(`/api/help-requests/${requestId}/response`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    markTimeout(requestId) {
      return http(`/api/help-requests/${requestId}/timeout`, {
        method: "POST",
      });
    },
  };
}

function createMockApi() {
  const STORAGE_KEY = "supervisor-console-state-v1";
  const now = Date.now();
  const minutesAgo = (mins) => new Date(now - mins * 60 * 1000).toISOString();
  const deepClone = (value) =>
    typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));

  const defaultState = {
    helpRequests: [
      {
        id: "REQ-1027",
        customerName: "Ava Stone",
        customerContact: "sms:+15550001",
        channel: "phone",
        question: "What are your stylists' Sunday hours?",
        status: "pending",
        answer: null,
        notes: "",
        createdAt: minutesAgo(55),
        escalatedAt: minutesAgo(53),
        resolvedAt: null,
        history: [
          {
            timestamp: minutesAgo(55),
            message:
              "Caller asked about weekend hours. AI escalated to supervisor.",
          },
          {
            timestamp: minutesAgo(53),
            message: "AI: Let me check with my supervisor and get back to you.",
          },
        ],
      },
      {
        id: "REQ-1028",
        customerName: "Miles Turner",
        customerContact: "sms:+15550002",
        channel: "sms",
        question: "Do you offer bridal trial packages?",
        status: "pending",
        answer: null,
        notes: "",
        createdAt: minutesAgo(32),
        escalatedAt: minutesAgo(31),
        resolvedAt: null,
        history: [
          {
            timestamp: minutesAgo(32),
            message: "AI escalated bridal inquiry for supervisor guidance.",
          },
        ],
      },
      {
        id: "REQ-1004",
        customerName: "Zoey Patel",
        customerContact: "sms:+15550003",
        channel: "phone",
        question: "Can I reschedule my color appointment next week?",
        status: "resolved",
        answer:
          "Absolutely! We can move your appointment to any weekday after 3pm.",
        notes: "",
        createdAt: minutesAgo(180),
        escalatedAt: minutesAgo(178),
        resolvedAt: minutesAgo(170),
        history: [
          {
            timestamp: minutesAgo(180),
            message: "Customer requested reschedule window.",
          },
          {
            timestamp: minutesAgo(170),
            message:
              "Supervisor: Confirmed weekday availability after 3pm and texted customer.",
          },
        ],
      },
    ],
    knowledgeBase: [
      {
        id: "KB-2001",
        sourceRequestId: "REQ-1004",
        topic: "Scheduling",
        question: "Can appointments be rescheduled?",
        answer: "Weekday slots after 3pm are typically available for reschedules.",
        updatedAt: minutesAgo(170),
      },
    ],
  };

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(defaultState);
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (err) {
      console.warn("Falling back to default mock data", err);
      return deepClone(defaultState);
    }
  }

  function normalizeState(value) {
    const base = deepClone(defaultState);
    if (value && Array.isArray(value.helpRequests)) {
      base.helpRequests = value.helpRequests.map((req) => ({
        ...req,
        history: Array.isArray(req.history)
          ? req.history.map((entry) => ({
              timestamp: entry.timestamp || new Date().toISOString(),
              message: entry.message || "",
            }))
          : [],
      }));
    }
    if (value && Array.isArray(value.knowledgeBase)) {
      base.knowledgeBase = value.knowledgeBase.map((entry) => ({
        ...entry,
        updatedAt: entry.updatedAt || new Date().toISOString(),
      }));
    }
    return base;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Failed to persist mock state", err);
    }
  }

  function clone(value) {
    return deepClone(value);
  }

  function delay(ms = 120) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function ensureRequest(requestId) {
    const request = state.helpRequests.find((req) => req.id === requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }
    return request;
  }

  function upsertKnowledgeBaseEntry({ request, topic, answer }) {
    const existingIndex = state.knowledgeBase.findIndex(
      (entry) => entry.sourceRequestId === request.id
    );
    const entry = {
      id: existingIndex >= 0 ? state.knowledgeBase[existingIndex].id : `KB-${Date.now()}`,
      sourceRequestId: request.id,
      topic: topic || "General",
      question: request.question,
      answer,
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      state.knowledgeBase.splice(existingIndex, 1, entry);
    } else {
      state.knowledgeBase.unshift(entry);
    }
  }

  async function fetchRequests(status) {
    await delay();
    const list = status
      ? state.helpRequests.filter((req) => req.status === status)
      : state.helpRequests;
    return clone(list);
  }

  async function fetchKnowledgeBase() {
    await delay();
    return clone(state.knowledgeBase);
  }

  async function submitResponse(requestId, payload) {
    await delay();
    const request = ensureRequest(requestId);
    const timestamp = new Date().toISOString();

    const unresolved = Boolean(payload.unresolved);
    const answer = (payload.answer || "").trim();
    const topic = (payload.topic || "General").trim();
    const notes = (payload.notes || "").trim();

    request.history = request.history || [];
    request.history.unshift({
      timestamp,
      message: unresolved
        ? `Supervisor marked unresolved: ${notes || "requires follow-up"}.`
        : `Supervisor responded: ${answer}`,
    });

    request.notes = notes;
    request.answer = answer;
    request.status = unresolved ? "unresolved" : "resolved";
    request.resolvedAt = unresolved ? null : timestamp;

    if (!unresolved && answer) {
      upsertKnowledgeBaseEntry({ request, topic, answer });
    }

    persist();
    return clone(request);
  }

  async function markTimeout(requestId) {
    await delay();
    const request = ensureRequest(requestId);
    const timestamp = new Date().toISOString();
    request.status = "unresolved";
    request.resolvedAt = null;
    request.history = request.history || [];
    request.history.unshift({
      timestamp,
      message: "Supervisor marked timeout. Awaiting follow-up.",
    });
    persist();
    return clone(request);
  }

  return {
    fetchRequests,
    fetchKnowledgeBase,
    submitResponse,
    markTimeout,
  };
}

const api = MODE === "live" ? createNetworkApi() : createMockApi();

export const fetchRequests = api.fetchRequests;
export const fetchKnowledgeBase = api.fetchKnowledgeBase;
export const submitResponse = api.submitResponse;
export const markTimeout = api.markTimeout;
