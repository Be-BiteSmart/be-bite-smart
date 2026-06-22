/**
 * Sensitive paths that must not be publicly readable (oops detector).
 * Paths are relative to the WordPress site root (PLAYWRIGHT_BASE_URL).
 *
 * Modes:
 * - `blocked` — must return 403 or 404 (file/dir must not be web-readable)
 * - `not-public` — any non-2xx passes (403/404/405/500 OK); fail only on 2xx body served
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
  // Config and secrets
  {
    path: "/wp-config.php",
    label: "wp-config.php",
    mode: "not-public",
    rationaleKey: "wp-config",
  },
  {
    path: "/wp-config-sample.php",
    label: "wp-config-sample.php",
    mode: "not-public",
  },
  { path: "/.env", label: ".env", mode: "blocked" },
  {
    path: "/wp-content/debug.log",
    label: "wp-content/debug.log",
    mode: "blocked",
  },

  // WordPress version / install surface
  {
    path: "/readme.html",
    label: "readme.html",
    mode: "blocked",
    rationaleKey: "readme-html",
  },
  {
    path: "/license.txt",
    label: "license.txt",
    mode: "blocked",
    rationaleKey: "license-txt",
  },

  // XML-RPC (GET should not return 2xx; RSD discovery must not be public)
  {
    path: "/xmlrpc.php",
    label: "xmlrpc.php",
    mode: "not-public",
    rationaleKey: "xmlrpc",
  },
  {
    path: "/xmlrpc.php?rsd",
    label: "xmlrpc.php RSD",
    mode: "not-public",
    rationaleKey: "xmlrpc-rsd",
  },

  // Backups, VCS, and dependency manifests
  {
    path: "/wp-content/backups-dup-lite/",
    label: "Duplicator backups directory",
    mode: "blocked",
    rationaleKey: "duplicator-backups",
  },
  {
    path: "/backup/",
    label: "backup directory",
    mode: "blocked",
  },
  { path: "/.git/HEAD", label: ".git/HEAD", mode: "blocked" },
  { path: "/composer.json", label: "composer.json", mode: "blocked" },
];

/** Strict block — must return 403 or 404 (used for .env and debug.log). */
export const BLOCKED_SENSITIVE_STATUSES = new Set([403, 404]);

export const SECURITY_RATIONALE = {
  "wp-config": `wp-config.php: pass on any non-2xx (500 OK). Shared hosts often return 500 when PHP runs before deny rules; forcing 403 needs extra server work we skip for this oops detector.`,
  "readme-html": `readme.html exposes the WordPress version to scanners. Delete the file from the web root or deny access in .htaccess.`,
  "license-txt": `license.txt exposes the WordPress version. Delete or deny web access (same hardening as readme.html).`,
  xmlrpc: `xmlrpc.php GET should not return 2xx. Production may return 405 (method not allowed) — acceptable. Disable XML-RPC entirely if not needed.`,
  "xmlrpc-rsd": `xmlrpc.php?rsd exposes XML-RPC discovery XML. Should not return 2xx — disable XML-RPC or block RSD.`,
  "duplicator-backups": `Duplicator backup archives must not be web-readable. Keep backups off the public web root when possible.`,
};

/** @deprecated Use SECURITY_RATIONALE["wp-config"] */
export const WP_CONFIG_RATIONALE = SECURITY_RATIONALE["wp-config"];

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
      `${path} returned HTTP ${status} — sensitive endpoint may be publicly readable. ` +
      "Expected non-2xx (403/404 ideal; 405/500 acceptable when the file or API is not served as a successful response)."
    );
  }

  return `${path} returned HTTP ${status} — sensitive file may be exposed; expected 403 or 404`;
}

export function rationaleForEntry(entry) {
  if (!entry.rationaleKey) {
    return null;
  }

  return SECURITY_RATIONALE[entry.rationaleKey] ?? null;
}
