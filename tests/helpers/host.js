import { expect } from "@playwright/test";

/** Production canonical origin (HTTPS + www). */
export const CANONICAL_ORIGIN = "https://www.bebitesmart.org";

/** Alternate host/scheme entry points that should resolve to the canonical origin. */
export const HOST_ENTRY_POINTS = [
  { label: "HTTP apex", url: "http://bebitesmart.org" },
  { label: "HTTP www", url: "http://www.bebitesmart.org" },
  { label: "HTTPS apex", url: "https://bebitesmart.org" },
];

const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);

export function shouldRunHostChecks(baseURL) {
  try {
    return new URL(baseURL).origin === CANONICAL_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * True when testing locally via the documented http://bebitesmart.local
 * convention (testing.md) — used specifically to dodge Local by Flywheel's
 * self-signed cert, since the browser context tolerates it fine for
 * page.goto() but the separate `request` API context (used for canonical/
 * link/download checks) does not. WordPress itself always emits absolute
 * URLs (canonical tags, nav hrefs that happen to be absolute, media library
 * URLs) at its real configured home_url() scheme, which is https:// even
 * when baseURL is http:// — so any check comparing against or fetching
 * those absolute URLs hits a scheme mismatch (or a cert error, if
 * ignoreHTTPSErrors isn't set) that has nothing to do with real content
 * correctness. Never true for staging/production, which always use https://
 * as their own baseURL, matching their own real scheme — only the local
 * workaround creates this specific mismatch.
 */
export function isLocalHttpWorkaround(baseURL) {
  return typeof baseURL === "string" && baseURL.startsWith("http://");
}

export function canonicalUrl(path) {
  return new URL(path, CANONICAL_ORIGIN).toString();
}

/**
 * Follow redirects and assert the final URL is the canonical HTTPS www origin.
 */
export async function assertResolvesToCanonical(request, entryOrigin, path, baseURL) {
  const startUrl = new URL(path, entryOrigin).toString();
  const expected = canonicalUrl(path);
  let url = startUrl;

  // If accessing staging, inject Basic Auth credentials
  if (baseURL?.includes("staging.")) {
    const username = process.env.STAGING_AUTH_USER;
    const password = process.env.STAGING_AUTH_PASS;
    if (username && password) {
      const urlObj = new URL(url, baseURL);
      urlObj.username = username;
      urlObj.password = password;
      url = urlObj.toString();
    }
  }

  const response = await request.get(url, {
    maxRedirects: 10,
    failOnStatusCode: false,
  });

  const finalUrl = response.url();
  const status = response.status();

  expect(status, `${startUrl} final status`).toBe(200);
  expect(
    finalUrl,
    `${startUrl} should resolve to ${expected}, got ${finalUrl}`,
  ).toBe(expected);
  expect(
    finalUrl.startsWith("https://"),
    `${startUrl} should end on HTTPS`,
  ).toBe(true);

  return { startUrl, finalUrl, expected, status };
}

/**
 * HTTP entry points must redirect to HTTPS on the first hop.
 */
export async function assertHttpsFirstRedirect(request, entryOrigin, path, baseURL) {
  const startUrl = new URL(path, entryOrigin).toString();
  let url = startUrl;

  // If accessing staging, inject Basic Auth credentials
  if (baseURL?.includes("staging.")) {
    const username = process.env.STAGING_AUTH_USER;
    const password = process.env.STAGING_AUTH_PASS;
    if (username && password) {
      const urlObj = new URL(url, baseURL);
      urlObj.username = username;
      urlObj.password = password;
      url = urlObj.toString();
    }
  }

  const response = await request.get(url, {
    maxRedirects: 0,
    failOnStatusCode: false,
  });

  const status = response.status();
  const location = response.headers().location ?? "";

  expect(
    REDIRECT_STATUSES.has(status),
    `${startUrl} should redirect, got HTTP ${status}`,
  ).toBe(true);

  expect(
    location.startsWith("https://"),
    `${startUrl} should redirect to HTTPS, got ${location || "(no Location header)"}`,
  ).toBe(true);

  return { startUrl, status, location };
}
