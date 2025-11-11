import { escapeHtml } from "../utils/dom.js";
import { formatTimestamp } from "../utils/formatters.js";

export function renderKnowledgeBase(container, state) {
  if (!state.knowledgeBase.length) {
    container.innerHTML = `<p class="placeholder">No learned answers yet.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="kb-summary">
      <h4>Learned Answers</h4>
      <span class="badge badge-muted">${state.knowledgeBase.length} entries</span>
    </div>
    <ul class="kb-list">
      ${state.knowledgeBase
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
        .join("")}
    </ul>
  `;
}
