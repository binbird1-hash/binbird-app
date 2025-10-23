const OPERATIONAL_DAY_ROLLOVER_HOUR: number = 6;
const JOB_VISIBILITY_BLOCK_START_HOUR: number = 6;
const JOB_VISIBILITY_BLOCK_END_HOUR: number = 14;

export function getLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getOperationalDate(now: Date = new Date()): Date {
  const operational = new Date(now);
  if (operational.getHours() < OPERATIONAL_DAY_ROLLOVER_HOUR) {
    operational.setDate(operational.getDate() - 1);
  }
  return operational;
}

export function getOperationalDayIndex(now: Date = new Date()): number {
  return getOperationalDate(now).getDay();
}

export function getOperationalDayName(
  now: Date = new Date(),
  locale: string = "en-AU"
): string {
  return getOperationalDate(now).toLocaleString(locale, { weekday: "long" });
}

export function getOperationalISODate(now: Date = new Date()): string {
  return getLocalISODate(getOperationalDate(now));
}

export function isJobVisibilityRestricted(now: Date = new Date()): boolean {
  const hour = now.getHours();

  if (JOB_VISIBILITY_BLOCK_START_HOUR === JOB_VISIBILITY_BLOCK_END_HOUR) {
    return true;
  }

  if (JOB_VISIBILITY_BLOCK_START_HOUR < JOB_VISIBILITY_BLOCK_END_HOUR) {
    return (
      hour >= JOB_VISIBILITY_BLOCK_START_HOUR &&
      hour < JOB_VISIBILITY_BLOCK_END_HOUR
    );
  }

  return (
    hour >= JOB_VISIBILITY_BLOCK_START_HOUR ||
    hour < JOB_VISIBILITY_BLOCK_END_HOUR
  );
}
