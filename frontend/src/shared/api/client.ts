import axios, { isAxiosError } from "axios";

/**
 * The one HTTP client: the site's own `/api/v1`, on the origin it is served
 * from (the web service proxies it in production, Vite in development). No
 * session, no token, no refresh: every route is public.
 */
export const api = axios.create({ baseURL: "/api/v1", timeout: 30_000 });

/** An error as a sentence for the reader: the server's own where it gave one
 *  (a refused build says why, a 429 says how long to wait), the fallback
 *  otherwise. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string" && detail) return detail;
  }
  return fallback;
}
