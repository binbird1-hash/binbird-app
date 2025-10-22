export const OPERATIONAL_DAY_ROLLOVER_HOUR = 4;

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type OperationalDayInfo = {
  /** Date object representing the operational day (with 4am rollover). */
  date: Date;
  /** ISO formatted date string for the operational day (YYYY-MM-DD). */
  isoDate: string;
  /** Canonical day of week name for the operational day. */
  dayName: string;
  /** Numeric day index (0 = Sunday ... 6 = Saturday). */
  dayIndex: number;
};

function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalISODate(date: Date = new Date()): string {
  return formatDateToISO(date);
}

export function getOperationalDate(baseDate: Date = new Date()): Date {
  const date = new Date(baseDate);
  if (date.getHours() < OPERATIONAL_DAY_ROLLOVER_HOUR) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

function resolveOverrideDayName(override: string | null | undefined) {
  if (!override) return null;
  const trimmed = override.trim();
  if (!trimmed.length) return null;

  const matchIndex = WEEKDAYS.findIndex(
    (day) => day.toLowerCase() === trimmed.toLowerCase()
  );

  if (matchIndex >= 0) {
    return {
      dayName: WEEKDAYS[matchIndex],
      dayIndex: matchIndex,
    };
  }

  return {
    dayName: trimmed,
    dayIndex: -1,
  } as const;
}

export function getOperationalDayInfo(options?: {
  now?: Date;
  devDayOverride?: string | null;
}): OperationalDayInfo {
  const now = options?.now ?? new Date();
  const override = resolveOverrideDayName(
    options?.devDayOverride ?? process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE
  );

  const operationalDate = getOperationalDate(now);
  const defaultDayIndex = operationalDate.getDay();
  const defaultDayName = WEEKDAYS[defaultDayIndex];

  const dayIndex = override?.dayIndex ?? defaultDayIndex;
  const dayName = override?.dayName ?? defaultDayName;

  return {
    date: operationalDate,
    isoDate: formatDateToISO(operationalDate),
    dayName,
    dayIndex,
  };
}

export function getOperationalISODate(options?: {
  now?: Date;
  devDayOverride?: string | null;
}): string {
  return getOperationalDayInfo(options).isoDate;
}
