export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getStartOfWeekString(reference: Date = new Date()): string {
  const start = new Date(reference);
  const day = start.getDay();
  const diff = (day + 6) % 7; // make Monday the start of the week
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return toDateOnlyString(start);
}
