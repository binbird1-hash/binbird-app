export const PENDING_SIGNUP_STORAGE_KEY = "binbird_pending_signup";

export type PendingSignUpData = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: "staff" | "client";
};

export function savePendingSignUp(data: PendingSignUpData) {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    PENDING_SIGNUP_STORAGE_KEY,
    JSON.stringify(data)
  );
}

export function loadPendingSignUp(): PendingSignUpData | null {
  if (typeof window === "undefined") return null;

  const stored = window.sessionStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as PendingSignUpData;
  } catch (error) {
    console.error("Failed to parse pending signup data", error);
    return null;
  }
}

export function clearPendingSignUp() {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
}
