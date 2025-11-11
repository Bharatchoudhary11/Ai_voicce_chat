const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(isoDate) {
  const delta = new Date(isoDate).getTime() - Date.now();
  const minutes = Math.round(delta / (1000 * 60));
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(days, "day");
}

export function formatTimestamp(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
