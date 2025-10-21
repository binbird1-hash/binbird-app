export function formatDurationSeconds(seconds: number): string {
  const clamped = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (parts.length === 0) {
    parts.push("<1m");
  }

  return parts.join(" ");
}

export function formatArrivalTime(seconds: number, referenceDate: Date = new Date()): string {
  const clamped = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const arrival = new Date(referenceDate.getTime() + clamped * 1000);
  return arrival.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
