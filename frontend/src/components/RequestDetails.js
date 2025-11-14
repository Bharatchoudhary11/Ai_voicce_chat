import { escapeHtml } from "../utils/dom.js";
import { formatTimestamp } from "../utils/formatters.js";
import { setState } from "../store.js";

const GREETING_REGEX =
  /^(hi|hello|hey|greetings|good (morning|afternoon|evening))\s+[a-z\s'.-]{0,40},?\s*/i;
const TEMPLATE_REGEX =
  /^(great question about|thanks for asking about|here's what we can share about)\s+[^.?!:]+[.?!:]\s*/i;
const TRAILING_HELLO_REGEX = /\bhello\b[.!?"]*$/i;

function stripTemplates(answer = "") {
  let text = (answer || "").trim();
  while (GREETING_REGEX.test(text)) {
    text = text.replace(GREETING_REGEX, "").trim();
  }
  while (TEMPLATE_REGEX.test(text)) {
    text = text.replace(TEMPLATE_REGEX, "").trim();
  }
  while (/:$/i.test(text)) {
    text = text.replace(/:$/i, "").trim();
  }
  text = text.replace(TRAILING_HELLO_REGEX, "").trim();
  return text.trim();
}

function scoreSuggestion(request, entry) {
  if (!entry) return 0;
  const words = request.question
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);
  if (!words.length) return 0;
  const haystack = `${entry.question} ${entry.answer} ${entry.topic}`.toLowerCase();
  return words.reduce((score, word) => (haystack.includes(word) ? score + 1 : score), 0);
}

function summarizeQuestion(question = "") {
  const cleaned = question.trim().replace(/\?+$/, "");
  if (!cleaned) return "";
  const snippets = cleaned.split(/[.!?]/).filter(Boolean);
  return snippets[0] || cleaned;
}

function buildPersonalizedAnswer(request, entry) {
  const summary = summarizeQuestion(request.question || entry.question);
  const customerName = request.customerName || "there";
  const topicCopy = summary ? summary.toLowerCase() : "that";
  const templates = [
    `Great question about ${topicCopy}.`,
    `Here's what we can share about ${topicCopy}:`,
    `Thanks for asking about ${topicCopy}.`,
  ];
  const prefix = templates[Math.floor(Math.random() * templates.length)];
  const salutation = `Hi ${customerName},`;
  const coreAnswer = stripTemplates(entry.answer) || entry.answer || "I'll dig into this and get back shortly.";
  const normalizedAnswer =
    coreAnswer.charAt(0).toUpperCase() + coreAnswer.slice(1).trim();
  return `${salutation} ${prefix} ${normalizedAnswer}`;
}

function findAiSuggestion(request, knowledgeBase) {
  if (!Array.isArray(knowledgeBase) || !knowledgeBase.length) return null;
  const scored = knowledgeBase
    .map((entry) => ({ entry, score: scoreSuggestion(request, entry) }))
    .sort((a, b) => b.score - a.score);
  const best =
    scored.find((item) => item.score > 0) ||
    (scored.length ? scored[0] : null);
  if (!best || !best.entry) return null;
  return {
    topic: best.entry.topic,
    answer: best.entry.answer,
    generatedAnswer: buildPersonalizedAnswer(request, best.entry),
    question: best.entry.question,
    sourceRequestId: best.entry.sourceRequestId,
    score: best.score,
  };
}

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

  const followUpStatusCopy = request.followUpReminderSent
    ? "Reminder sent"
    : request.followUpAt
    ? "Awaiting reminder"
    : "Not scheduled";

  const followUpDefaultMinutes = (() => {
    if (!request.followUpAt) return 30;
    const msDiff = new Date(request.followUpAt).getTime() - Date.now();
    const minutes = Math.round(msDiff / 60000);
    if (!Number.isFinite(minutes)) return 30;
    return Math.max(5, Math.abs(minutes));
  })();
  const aiSuggestion = findAiSuggestion(request, state.knowledgeBase);
  const isChatOpen = state.activeChatRequestId === request.id;
  const chatMessages = (request.history || []).slice().reverse();

  container.innerHTML = `
    <article class="request-detail">
      <header class="request-detail__header">
        <div>
          <h3>${escapeHtml(request.question)}</h3>
          <p>
            <button type="button" class="customer-link" data-chat-toggle>
              ${escapeHtml(request.customerName)}
            </button>
            • ${escapeHtml(request.channel)}
          </p>
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
          <div>
            <dt>Follow-up due</dt>
            <dd>${
              request.followUpAt ? formatTimestamp(request.followUpAt) : "—"
            }</dd>
          </div>
          <div>
            <dt>Follow-up status</dt>
            <dd>${followUpStatusCopy}</dd>
          </div>
        </dl>
      </section>

      <section class="request-detail__chat ${isChatOpen ? "is-open" : ""}">
        <header>
          <div>
            <h4>Live chat transcript</h4>
            <p>${escapeHtml(request.customerName)} & supervisor</p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-compact"
            data-chat-close
            ${isChatOpen ? "" : 'style="display:none;"'}
          >
            Close chat
          </button>
        </header>
        <div class="chat-thread">
          ${
            chatMessages.length
              ? chatMessages
                  .map((entry) => {
                    const normalized = entry.message.toLowerCase();
                    const isSupervisor =
                      normalized.includes("supervisor") ||
                      normalized.includes("ai:") ||
                      normalized.includes("ai ");
                    const bubbleClass = isSupervisor
                      ? "chat-bubble chat-bubble--supervisor"
                      : "chat-bubble chat-bubble--customer";
                    return `
                      <article class="${bubbleClass}">
                        <span class="chat-timestamp">${formatTimestamp(entry.timestamp)}</span>
                        <p>${escapeHtml(entry.message)}</p>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="placeholder">No transcript available yet.</p>`
          }
        </div>
      </section>

      ${
        aiSuggestion
          ? `
      <section class="ai-suggestion-card">
        <header>
          <div>
            <p class="ai-suggestion-card__eyebrow">AI suggested reply</p>
            <h4>${escapeHtml(aiSuggestion.topic)}</h4>
            <p class="ai-suggestion-card__question">${escapeHtml(aiSuggestion.question)}</p>
          </div>
          <span class="badge badge-muted">Source ${escapeHtml(aiSuggestion.sourceRequestId)}</span>
        </header>
        <p class="ai-suggestion-card__answer">
          ${escapeHtml(aiSuggestion.generatedAnswer)}
        </p>
        <div class="ai-suggestion-card__actions">
          <button
            type="button"
            class="btn btn-ghost btn-compact"
            data-suggestion-fill
            data-suggestion-answer="${encodeURIComponent(aiSuggestion.generatedAnswer)}"
          >
            Use suggestion
          </button>
          <button
            type="button"
            class="btn btn-primary btn-compact"
            data-suggestion-send
            data-suggestion-answer="${encodeURIComponent(aiSuggestion.generatedAnswer)}"
          >
            Send immediately
          </button>
        </div>
      </section>`
          : ""
      }

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

          <label data-followup-field>
            <span>Follow-up window (minutes)</span>
            <input
              type="number"
              name="followUpMinutes"
              min="5"
              max="720"
              step="5"
              value="${followUpDefaultMinutes}"
              ${disableInputs ? "disabled" : ""}
            />
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
  const followUpLabel = form.querySelector('[data-followup-field]');
  const followUpField = form.querySelector('input[name="followUpMinutes"]');
  const chatToggle = container.querySelector("[data-chat-toggle]");
  const chatClose = container.querySelector("[data-chat-close]");
  const suggestionFillBtn = container.querySelector("[data-suggestion-fill]");
  const suggestionSendBtn = container.querySelector("[data-suggestion-send]");

  const toggleAnswerState = () => {
    if (unresolvedCheckbox.checked) {
      answerField.setAttribute("placeholder", "Describe why this could not be resolved…");
    } else {
      answerField.setAttribute("placeholder", "Type the guidance you want the AI to relay…");
    }
  };

  const toggleFollowUpField = () => {
    if (!followUpLabel || !followUpField) return;
    if (unresolvedCheckbox.checked) {
      followUpLabel.style.display = "block";
      followUpField.removeAttribute("disabled");
    } else {
      followUpLabel.style.display = "none";
      followUpField.setAttribute("disabled", "disabled");
    }
  };

  unresolvedCheckbox.addEventListener("change", toggleAnswerState);
  unresolvedCheckbox.addEventListener("change", toggleFollowUpField);
  toggleAnswerState();
  toggleFollowUpField();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.isSaving) return;
    const formData = new FormData(form);
    const unresolved = formData.get("unresolved") === "on";
    const answer = (formData.get("answer") || "").trim();
    const topic = (formData.get("topic") || "").trim();
    const notes = (formData.get("notes") || "").trim();
    const followUpValue = (formData.get("followUpMinutes") || "").toString().trim();
    const followUpMinutes = followUpValue ? Number.parseInt(followUpValue, 10) : null;

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
      followUpMinutes: unresolved ? followUpMinutes : null,
    });
    const reset = () => {
      form.reset();
      toggleAnswerState();
      if (followUpField) {
        followUpField.value = `${followUpDefaultMinutes}`;
      }
      toggleFollowUpField();
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

  if (chatToggle) {
    chatToggle.addEventListener("click", () => {
      setState({
        activeChatRequestId: isChatOpen ? null : request.id,
      });
    });
  }

  if (chatClose) {
    chatClose.addEventListener("click", () => {
      setState({ activeChatRequestId: null });
    });
  }

  const applySuggestion = (targetAnswer) => {
    if (!targetAnswer) return;
    answerField.value = targetAnswer;
    answerField.dispatchEvent(new Event("input", { bubbles: true }));
  };

  if (suggestionFillBtn) {
    suggestionFillBtn.addEventListener("click", () => {
      const text = decodeURIComponent(suggestionFillBtn.dataset.suggestionAnswer || "");
      applySuggestion(text);
    });
  }

  if (suggestionSendBtn) {
    suggestionSendBtn.addEventListener("click", () => {
      const text = decodeURIComponent(suggestionSendBtn.dataset.suggestionAnswer || "");
      applySuggestion(text);
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }
}
