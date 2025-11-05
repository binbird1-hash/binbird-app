const ENV_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const ENV_VERCEL_URL = process.env.NEXT_PUBLIC_VERCEL_URL;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getAppBaseUrl(): string {
  if (ENV_SITE_URL && ENV_SITE_URL.trim().length > 0) {
    return normalizeBaseUrl(ENV_SITE_URL);
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  if (ENV_VERCEL_URL && ENV_VERCEL_URL.trim().length > 0) {
    return normalizeBaseUrl(`https://${ENV_VERCEL_URL}`);
  }

  return "http://localhost:3000";
}

export function buildAppUrl(path: string): string {
  const baseUrl = getAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}
