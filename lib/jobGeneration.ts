import { getBinSchedule } from "@/lib/binSchedule";
import { getOperationalDayIndex, getOperationalDayName } from "@/lib/date";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export type JobSourceClientRow = {
  property_id: string;
  account_id: string | null;
  client_name: string | null;
  company: string | null;
  address: string | null;
  collection_day: string | null;
  put_bins_out: string | null;
  notes: string | null;
  assigned_to: string | null;
  lat_lng: string | null;
  photo_path: string | null;
  red_freq: string | null;
  red_flip: string | null;
  yellow_freq: string | null;
  yellow_flip: string | null;
  green_freq: string | null;
  green_flip: string | null;
};

const tokensFor = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

export const parseDayIndex = (value: string | null | undefined): number | null => {
  const tokens = tokensFor(value);
  for (const token of tokens) {
    const idx = DAY_ALIASES[token];
    if (idx !== undefined) {
      return idx;
    }
  }
  return null;
};

export const matchesDay = (value: string | null, dayIndex: number): boolean =>
  tokensFor(value).some((token) => DAY_ALIASES[token] === dayIndex);

export const extractDayNames = (value: string | null | undefined): string[] => {
  const dayIndexes = new Set<number>();
  tokensFor(value).forEach((token) => {
    const idx = DAY_ALIASES[token];
    if (idx !== undefined) {
      dayIndexes.add(idx);
    }
  });

  return [...dayIndexes]
    .sort((a, b) => a - b)
    .map((idx) => DAY_NAMES[idx]);
};

export const parseLatLng = (value: string | null): { lat: number | null; lng: number | null } => {
  if (!value) return { lat: null, lng: null };
  const [latRaw, lngRaw] = value.split(",").map((part) => Number.parseFloat(part.trim()));
  return {
    lat: Number.isFinite(latRaw) ? latRaw : null,
    lng: Number.isFinite(lngRaw) ? lngRaw : null,
  };
};

export const deriveAccountId = (row: JobSourceClientRow): string | null => {
  const explicit = row.account_id?.trim();
  return explicit && explicit.length > 0 ? explicit : null;
};

export const deriveClientName = (row: JobSourceClientRow): string =>
  row.client_name?.trim() || row.company?.trim() || "Client";

export const buildBinsSummary = (row: JobSourceClientRow): string | null => {
  const schedule = getBinSchedule({
    red_freq: row.red_freq,
    red_flip: row.red_flip,
    yellow_freq: row.yellow_freq,
    yellow_flip: row.yellow_flip,
    green_freq: row.green_freq,
    green_flip: row.green_flip,
  });

  if (!schedule.activeColors.length) return null;
  return schedule.activeColors.join(", ");
};

export const getJobGenerationDayInfo = () => {
  const override = process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE ?? null;
  const overrideIndex = parseDayIndex(override);
  const operationalIndex = getOperationalDayIndex();
  const dayIndex = overrideIndex ?? operationalIndex;
  const dayName = overrideIndex !== null ? DAY_NAMES[dayIndex] : getOperationalDayName();

  return { dayIndex, dayName };
};
