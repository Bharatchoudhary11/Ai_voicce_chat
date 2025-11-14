import { escapeHtml } from "../utils/dom.js";
import { formatTimestamp } from "../utils/formatters.js";

const VIEW_OPTIONS = [
  { id: "selection", label: "Selected customer" },
  { id: "all", label: "All conversations" },
];

export function renderKnowledgeBase(container, state, { onToggleView, onSearch }) {
  const hasEntries = state.knowledgeBase.length > 0;
  if (!hasEntries) {
    container.innerHTML = `<p class="placeholder">No learned answers yet.</p>`;
    return;
  }

  const viewMode = state.kbViewMode || "selection";
  const selectedId = state.selectedRequestId;
  const searchQuery = (state.kbSearch || "").toLowerCase().trim();

  let entries = state.knowledgeBase;
  let filteredLabel = "All conversations";

  if (viewMode === "selection" && selectedId) {
    const narrowed = state.knowledgeBase.filter(
      (entry) => entry.sourceRequestId === selectedId
    );
    if (narrowed.length) {
      entries = narrowed;
      filteredLabel = `Answers shared with ${selectedId}`;
    } else {
      filteredLabel = `No saved answers yet for ${selectedId}`;
      entries = [];
    }
  }

  if (searchQuery) {
    entries = entries.filter((entry) => {
      const haystack = `${entry.topic} ${entry.question} ${entry.answer}`.toLowerCase();
      return haystack.includes(searchQuery);
    });
  }

  container.innerHTML = `
    <div class="kb-toolbar">
      <div class="kb-view-toggle" role="tablist" aria-label="Knowledge base filter">
        ${VIEW_OPTIONS.map(
          (option) => `
            <button
              type="button"
              class="kb-view-toggle__btn ${option.id === viewMode ? "is-active" : ""}"
              data-kb-view="${option.id}"
              role="tab"
              aria-selected="${option.id === viewMode}"
            >
              ${option.label}
            </button>
          `
        ).join("")}
      </div>
      <label class="kb-search">
        <span class="sr-only">Search knowledge base</span>
        <input
          type="search"
          placeholder="Search saved answers..."
          value="${escapeHtml(state.kbSearch || "")}"
          data-kb-search
        />
      </label>
    </div>
    <div class="kb-summary">
      <div>
        <h4>Learned Answers</h4>
        <p class="kb-summary__hint">${escapeHtml(filteredLabel)}</p>
      </div>
      <span class="badge badge-muted">${entries.length} entries</span>
    </div>
    <ul class="kb-list">
      ${
        entries.length
          ? entries
              .map(
                (entry) => `
        <li>
          <header>
            <strong>${escapeHtml(entry.topic)}</strong>
            <span>${formatTimestamp(entry.updatedAt)}</span>
          </header>
          <p class="kb-question">${escapeHtml(entry.question)}</p>
          <p class="kb-answer">${escapeHtml(entry.answer)}</p>
          <footer>Source: ${entry.sourceRequestId}</footer>
        </li>
      `
              )
              .join("")
          : `<li class="empty-card"><p class="placeholder">No answers match your filters.</p></li>`
      }
    </ul>
  `;

  container.querySelectorAll("[data-kb-view]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const mode = btn.dataset.kbView;
      if (mode && mode !== viewMode) {
        onToggleView(mode);
      }
    })
  );

  const searchInput = container.querySelector("[data-kb-search]");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      onSearch(event.target.value);
    });
  }
}
