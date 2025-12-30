import { getOperationalDate } from "./date";

export type CustomWeekLabel = {
  year: number;
  week: string;
};

export function getCustomWeek(date: Date): CustomWeekLabel {
  const d = new Date(date);

  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }

  const target = new Date(d.valueOf());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));

  return {
    year: target.getFullYear(),
    week: `Week-${week}`,
  };
}

export function getWeekNumberFromLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = /^Week-(\d+)$/i.exec(label.trim());
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getWeekParity(date: Date = new Date()): "odd" | "even" {
  const { week } = getCustomWeek(getOperationalDate(date));
  const weekNumber = getWeekNumberFromLabel(week);
  if (!weekNumber) return "odd";
  return weekNumber % 2 === 0 ? "even" : "odd";
}

export function getWeekInfoFromIso(dateIso: string | null | undefined): {
  label: string | null;
  year: number | null;
  parity: "odd" | "even" | null;
} {
  if (!dateIso) {
    return { label: null, year: null, parity: null };
  }

  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return { label: null, year: null, parity: null };
  }

  const { week, year } = getCustomWeek(parsed);
  const parity = getWeekParity(parsed);

  return { label: week, year, parity };
}
