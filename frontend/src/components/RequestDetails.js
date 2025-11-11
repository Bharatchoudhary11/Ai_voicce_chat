import { escapeHtml } from "../utils/dom.js";
import { formatTimestamp } from "../utils/formatters.js";

export function renderRequestDetails(container, state, { onRespond, onTimeout }) {
  const request = state.requests.find((r) => r.id === state.selectedRequestId);
  if (!request) {
    container.innerHTML = `<p class="placeholder">Select a request to view details.</p>`;
    return;
  }

  const disableInputs = state.isSaving;
  const statusCopy =
    request.status === "pending"
      ? "Waiting for supervisor"
      : request.status === "resolved"
      ? "Resolved"
      : "Marked unresolved";

  container.innerHTML = `
    <article class="request-detail">
      <header class="request-detail__header">
        <div>
          <h3>${escapeHtml(request.question)}</h3>
          <p>${escapeHtml(request.customerName)} • ${escapeHtml(request.channel)}</p>
        </div>
        <span class="status-pill status-${request.status}">${statusCopy}</span>
      </header>

      <section class="request-detail__meta">
        <dl>
          <div>
            <dt>Request ID</dt>
            <dd>${request.id}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>${formatTimestamp(request.createdAt)}</dd>
          </div>
          <div>
            <dt>Escalated</dt>
            <dd>${request.escalatedAt ? formatTimestamp(request.escalatedAt) : "—"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>${statusCopy}</dd>
          </div>
        </dl>
      </section>

      <section class="request-detail__history">
        <h4>Interaction History</h4>
        <ul>
          ${(request.history || [])
            .map(
              (entry) => `
            <li>
              <span>${formatTimestamp(entry.timestamp)}</span>
              <p>${escapeHtml(entry.message)}</p>
            </li>`
            )
            .join("")}
        </ul>
      </section>

      <section class="request-detail__form">
        <h4>Supervisor Response</h4>
        <form id="response-form">
          <label>
            <span>Answer to send back</span>
            <textarea
              name="answer"
              rows="4"
              placeholder="Type the guidance you want the AI to relay…"
              ${disableInputs ? "disabled" : ""}
            ></textarea>
          </label>
          <label>
            <span>Topic (for knowledge base)</span>
            <input
              type="text"
              name="topic"
              placeholder="e.g., Holiday Hours"
              ${disableInputs ? "disabled" : ""}
            />
          </label>

          <label class="checkbox-row">
            <input type="checkbox" name="unresolved" ${disableInputs ? "disabled" : ""} />
            This request is still unresolved (timeout or needs callback)
          </label>

          <label>
            <span>Internal notes</span>
            <textarea
              name="notes"
              rows="2"
              placeholder="Optional notes for the team"
              ${disableInputs ? "disabled" : ""}
            ></textarea>
          </label>

          <div class="request-detail__actions">
            <button type="submit" class="btn btn-primary" ${disableInputs ? "disabled" : ""}>
              ${state.isSaving ? "Sending…" : "Send answer & update KB"}
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              data-timeout
              ${disableInputs ? "disabled" : ""}
            >
              Mark timeout
            </button>
          </div>
          <p class="form-hint">Tip: Answers automatically text the customer and add to the knowledge base if marked resolved.</p>
        </form>
      </section>
    </article>
  `;

  const form = container.querySelector("#response-form");
  const timeoutBtn = container.querySelector("[data-timeout]");
  const unresolvedCheckbox = form.querySelector('input[name="unresolved"]');
  const answerField = form.querySelector('textarea[name="answer"]');

  const toggleAnswerState = () => {
    if (unresolvedCheckbox.checked) {
      answerField.setAttribute("placeholder", "Describe why this could not be resolved…");
    } else {
      answerField.setAttribute("placeholder", "Type the guidance you want the AI to relay…");
    }
  };

  unresolvedCheckbox.addEventListener("change", toggleAnswerState);
  toggleAnswerState();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.isSaving) return;
    const formData = new FormData(form);
    const unresolved = formData.get("unresolved") === "on";
    const answer = (formData.get("answer") || "").trim();
    const topic = (formData.get("topic") || "").trim();
    const notes = (formData.get("notes") || "").trim();

    if (!unresolved && !answer) {
      form.querySelector(".form-hint").textContent =
        "Please provide an answer or mark the request unresolved.";
      return;
    }

    const result = onRespond({
      answer: unresolved ? notes || "Unable to resolve. Needs follow-up." : answer,
      topic: topic || "General",
      unresolved,
      notes,
    });
    const reset = () => {
      form.reset();
      toggleAnswerState();
      form.querySelector(".form-hint").textContent =
        "Tip: Answers automatically text the customer and add to the knowledge base if marked resolved.";
    };
    if (result?.then) {
      result.then(reset);
    } else {
      reset();
    }
  });

  timeoutBtn.addEventListener("click", () => {
    if (state.isSaving) return;
    onTimeout();
  });
}
