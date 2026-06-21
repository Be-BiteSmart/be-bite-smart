/**
 * Sensitive paths that must not be publicly readable (oops detector).
 * Paths are relative to the WordPress site root (PLAYWRIGHT_BASE_URL).
 */

/**
 * wp-config.php — "not-public" mode (any non-2xx passes, including 500).
 *
 * On shared hosts (e.g. DreamHost), direct requests to /wp-config.php often hit
 * the PHP handler before .htaccess deny rules run. The server returns 500 (PHP
 * abort) rather than 403 Forbidden — but the config is still not served as a
 * successful download (no 2xx body with credentials).
 *
 * We intentionally do NOT require 403 here. A true 403 would mean moving
 * wp-config.php above the web root or custom server config — extra work beyond
 * this lightweight CI check. Fail only if the URL returns 2xx (file exposed).
 */
export const SENSITIVE_PATHS = [
  {
    path: "/wp-config.php",
    label: "wp-config.php",
    mode: "not-public",
  },
  { path: "/.env", label: ".env", mode: "blocked" },
  {
    path: "/wp-content/debug.log",
    label: "wp-content/debug.log",
    mode: "blocked",
  },
];

/** Strict block — must return 403 or 404 (used for .env and debug.log). */
export const BLOCKED_SENSITIVE_STATUSES = new Set([403, 404]);

/**
 * @param {number} status
 * @param {"blocked" | "not-public"} mode
 * @returns {boolean}
 */
export function isSensitivePathBlocked(status, mode = "blocked") {
  if (mode === "not-public") {
    return status < 200 || status >= 300;
  }

  return BLOCKED_SENSITIVE_STATUSES.has(status);
}

/**
 * @param {number} status
 * @param {{ mode?: "blocked" | "not-public" }} options
 * @returns {string}
 */
export function sensitivePathFailureMessage(
  path,
  status,
  { mode = "blocked" } = {},
) {
  if (mode === "not-public") {
    return (
      `${path} returned HTTP ${status} — wp-config may be publicly served. ` +
      "Expected non-2xx (403/404 ideal; 500 acceptable on shared hosts when PHP aborts). " +
      "We do not require 403 — that would need wp-config above the web root or host-level config."
    );
  }

  return `${path} returned HTTP ${status} — sensitive file may be exposed; expected 403 or 404`;
}

export const WP_CONFIG_RATIONALE =
  "wp-config.php: pass on any non-2xx (500 OK). Shared hosts often return 500 when PHP runs before deny rules; forcing 403 needs extra server work we skip for this oops detector.";
