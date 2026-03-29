export const qs = (selector) => document.querySelector(selector);
export const qsa = (selector) => Array.from(document.querySelectorAll(selector));

export function setStatus(text) {
  qs("#status-pill").textContent = text;
}

export function setConnection(text) {
  qs("#chat-connection").textContent = text;
}

export function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
