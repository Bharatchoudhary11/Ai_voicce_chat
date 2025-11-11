const API_BASE_URL = (window.__SUPERVISOR_API_BASE__ || "http://localhost:8000").replace(
  /\/$/,
  ""
);

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

export async function fetchRequests(status) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const query = params.toString() ? `?${params.toString()}` : "";
  return http(`/api/help-requests${query}`);
}

export async function fetchKnowledgeBase() {
  return http("/api/knowledge-base");
}

export async function submitResponse(requestId, payload) {
  return http(`/api/help-requests/${requestId}/response`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markTimeout(requestId) {
  return http(`/api/help-requests/${requestId}/timeout`, {
    method: "POST",
  });
}
