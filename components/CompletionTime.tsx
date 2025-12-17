"use client";

import { useMemo } from "react";

interface CompletionTimeProps {
  isoString: string;
}

const formatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function CompletionTime({ isoString }: CompletionTimeProps) {
  const label = useMemo(() => {
    if (!isoString) return "Completed";

    const parsed = new Date(isoString);
    if (Number.isNaN(parsed.getTime())) return "Completed";

    return formatter.format(parsed);
  }, [isoString]);

  return <span className="text-gray-500">{label}</span>;
}
