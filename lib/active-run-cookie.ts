export const ACTIVE_RUN_COOKIE_NAME = "binbird-active-run";

function setCookie(value: string, options?: { maxAge?: number }) {
  if (typeof document === "undefined") return;

  const segments = [
    `${ACTIVE_RUN_COOKIE_NAME}=${value}`,
    "path=/",
    "SameSite=Lax",
  ];

  if (options?.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  document.cookie = segments.join("; ");
}

export function setActiveRunCookie() {
  setCookie("true");
}

export function clearActiveRunCookie() {
  setCookie("", { maxAge: 0 });
}

export function syncActiveRunCookie(hasActiveRun: boolean) {
  if (hasActiveRun) {
    setActiveRunCookie();
  } else {
    clearActiveRunCookie();
  }
}
