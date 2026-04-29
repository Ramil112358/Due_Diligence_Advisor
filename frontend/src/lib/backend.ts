/**
 * Backend URL helpers.
 *
 * - `BACKEND_URL` is read on the server (RSC, route handlers if any).
 * - `NEXT_PUBLIC_BACKEND_URL` is read in the browser.
 */
export const SERVER_BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export const PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export function backendUrl(path: string, opts?: { server?: boolean }): string {
  const base = opts?.server ? SERVER_BACKEND_URL : PUBLIC_BACKEND_URL;
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
