import { relativeTime } from "../utils/formatters.js";
import { escapeHtml } from "../utils/dom.js";

const statusOrder = {
  pending: 0,
  unresolved: 1,
  resolved: 2,
};

const statusCopy = {
  pending: "Pending",
  resolved: "Resolved",
  unresolved: "Needs follow-up",
};

export function renderRequestList(container, state, { onSelect }) {
  if (!state.requests.length) {
    container.innerHTML = `<p class="placeholder">No pending requests 🎉</p>`;
    return;
  }

  const sorted = [...state.requests].sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const pendingCount = state.requests.filter((r) => r.status === "pending").length;

  container.innerHTML = `
    <div class="request-list__summary">
      <span class="badge badge-muted">Pending: ${pendingCount}</span>
      <span class="badge badge-muted">Resolved: ${
        state.requests.filter((r) => r.status === "resolved").length
      }</span>
      <span class="badge badge-muted">Unresolved: ${
        state.requests.filter((r) => r.status === "unresolved").length
      }</span>
    </div>
    <ul class="request-list">
      ${sorted
        .map((req) => {
          const selected = req.id === state.selectedRequestId;
          return `
          <li class="request-card ${selected ? "is-selected" : ""}">
            <button class="request-card__inner" data-select="${req.id}">
              <div class="request-card__header">
                <div>
                  <p class="request-card__customer">${escapeHtml(req.customerName)}</p>
                  <p class="request-card__channel">${escapeHtml(req.channel)}</p>
                </div>
                <span class="status-pill status-${req.status}">
                  ${statusCopy[req.status] ?? req.status}
                </span>
              </div>
              <p class="request-card__question">${escapeHtml(req.question)}</p>
              <div class="request-card__meta">
                <span>Escalated ${relativeTime(req.escalatedAt || req.createdAt)}</span>
                <span>${req.history?.length ?? 0} updates</span>
              </div>
            </button>
          </li>
        `;
        })
        .join("")}
    </ul>
  `;

  container.querySelectorAll("[data-select]").forEach((btn) =>
    btn.addEventListener("click", () => {
      onSelect(btn.dataset.select);
    })
  );
}
