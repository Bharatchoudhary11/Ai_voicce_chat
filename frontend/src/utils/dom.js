const map = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

export function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (ch) => map[ch]);
}
