type BinColor = "red" | "yellow" | "green";
type BinSelection = Partial<Record<`${BinColor}_freq` | `${BinColor}_flip`, string | null | undefined>>;

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const REFERENCE_START = Date.UTC(2024, 7, 4, 6, 0, 0); // 2024-08-04 06:00:00 UTC

const normalise = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

export const isBinScheduledThisWeek = (frequency: string | null, flip: string | null, now = new Date()): boolean => {
  const frequencyValue = normalise(frequency);
  if (!frequencyValue) return false;
  if (frequencyValue === "weekly") return true;
  if (frequencyValue !== "fortnightly") return false;

  const weeksSinceStart = Math.floor((now.getTime() - REFERENCE_START) / WEEK_IN_MS);
  const isEvenWeek = weeksSinceStart % 2 === 0;
  const isFlipped = normalise(flip) === "yes";

  // Supabase logic: no flip => odd weeks, flip => even weeks
  return isFlipped ? isEvenWeek : !isEvenWeek;
};

export const getBinSchedule = (selection: BinSelection, now = new Date()) => {
  const status: Record<BinColor, boolean> = {
    red: isBinScheduledThisWeek(selection.red_freq ?? null, selection.red_flip ?? null, now),
    yellow: isBinScheduledThisWeek(selection.yellow_freq ?? null, selection.yellow_flip ?? null, now),
    green: isBinScheduledThisWeek(selection.green_freq ?? null, selection.green_flip ?? null, now),
  };

  return {
    status,
    activeColors: (["red", "yellow", "green"] as const)
      .filter((color) => status[color])
      .map((color) => color[0].toUpperCase() + color.slice(1)),
  };
};
