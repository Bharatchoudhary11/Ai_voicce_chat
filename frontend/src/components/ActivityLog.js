import { formatTimestamp } from "../utils/formatters.js";

const toneClass = {
  success: "log-success",
  error: "log-error",
  warn: "log-warn",
  info: "log-info",
};

export function renderActivityLog(container, state) {
  const entries = state.activityLog ?? [];
  if (!entries.length) {
    container.innerHTML = `<p class="placeholder">No activity yet.</p>`;
    return;
  }

  container.innerHTML = `
    <ul class="activity-log">
      ${entries
        .slice(0, 6)
        .map(
          (entry) => `
          <li class="${toneClass[entry.tone] ?? toneClass.info}">
            <p>${entry.message}</p>
            <span>${formatTimestamp(entry.timestamp)}</span>
          </li>
        `
        )
        .join("")}
    </ul>
  `;
}
