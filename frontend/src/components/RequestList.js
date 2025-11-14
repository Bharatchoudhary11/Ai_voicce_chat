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

const DEFAULT_FIX_WINDOW_MINUTES = 30;
const MS_IN_MINUTE = 60 * 1000;

function computeFixEta(request) {
  const baseTimestamp = request.followUpAt || request.escalatedAt || request.createdAt;
  if (!baseTimestamp) return null;
  const baseMs = new Date(baseTimestamp).getTime();
  if (!Number.isFinite(baseMs)) return null;
  const targetMs = request.followUpAt
    ? baseMs
    : baseMs + DEFAULT_FIX_WINDOW_MINUTES * MS_IN_MINUTE;
  const diffMinutes = Math.round((targetMs - Date.now()) / MS_IN_MINUTE);
  const magnitude = Math.abs(diffMinutes);
  if (diffMinutes > 0) {
    return { label: `Fix due in ${magnitude}m`, overdue: false };
  }
  if (diffMinutes < 0) {
    return { label: `Overdue ${magnitude}m`, overdue: true };
  }
  return { label: "Fix due now", overdue: false };
}

const filters = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "unresolved", label: "Needs Follow-up" },
  { id: "resolved", label: "Resolved" },
];

export function renderRequestList(container, state, { onSelect, onFilterChange, onSearchChange }) {
  if (!state.requests.length) {
    container.innerHTML = `<p class="placeholder">No pending requests 🎉</p>`;
    return;
  }

  const activeFilter = state.requestFilter || "all";
  const searchQuery = (state.requestSearch || "").toLowerCase();

  const filtered = state.requests.filter((req) => {
    const matchesFilter = activeFilter === "all" ? true : req.status === activeFilter;
    const matchesQuery =
      !searchQuery ||
      req.customerName.toLowerCase().includes(searchQuery) ||
      req.question.toLowerCase().includes(searchQuery) ||
      req.id.toLowerCase().includes(searchQuery);
    return matchesFilter && matchesQuery;
  });

  const sorted = [...filtered].sort((a, b) => {
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
    <div class="request-list__controls">
      <div class="filter-group" role="tablist" aria-label="Request filters">
        ${filters
          .map(
            (filter) => `
            <button
              type="button"
              class="filter-chip ${filter.id === activeFilter ? "is-active" : ""}"
              data-filter="${filter.id}"
              role="tab"
              aria-selected="${filter.id === activeFilter}"
            >
              ${filter.label}
            </button>
          `
          )
          .join("")}
      </div>
      <label class="request-search">
        <span class="sr-only">Search requests</span>
        <input
          type="search"
          placeholder="Search ID, customer, or question..."
          value="${escapeHtml(state.requestSearch || "")}"
          data-request-search
        />
        <span class="request-search__icon">⌕</span>
      </label>
    </div>
    <ul class="request-list">
      ${
        sorted.length
          ? sorted
              .map((req) => {
                const selected = req.id === state.selectedRequestId;
                const fixEta = req.status === "pending" ? computeFixEta(req) : null;
                return `
            <li
              class="request-card ${selected ? "is-selected" : ""}"
              data-select="${req.id}"
              role="button"
              tabindex="0"
            >
              <div class="request-card__inner">
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
                ${
                  fixEta
                    ? `<p class="request-card__sla ${
                        fixEta.overdue ? "is-overdue" : ""
                      }">${escapeHtml(fixEta.label)}</p>`
                    : ""
                }
              </div>
            </li>
          `;
              })
              .join("")
          : `<li class="request-card">
              <div class="request-card__inner empty-card">
                <p class="placeholder">No requests match your filters.</p>
              </div>
            </li>`
      }
    </ul>
  `;

  container.querySelectorAll("[data-select]").forEach((card) => {
    const targetId = card.dataset.select;
    const select = () => {
      if (!targetId) return;
      onSelect(targetId);
    };
    card.addEventListener("click", select);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });

  container.querySelectorAll("[data-filter]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const nextFilter = btn.dataset.filter;
      if (nextFilter === state.requestFilter) return;
      onFilterChange(nextFilter);
    })
  );

  const searchInput = container.querySelector("[data-request-search]");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      onSearchChange(event.target.value);
    });
  }
}
