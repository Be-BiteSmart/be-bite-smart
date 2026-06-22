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

export function canonicalUrl(path) {
  return new URL(path, CANONICAL_ORIGIN).toString();
}

/**
 * Follow redirects and assert the final URL is the canonical HTTPS www origin.
 */
export async function assertResolvesToCanonical(request, entryOrigin, path) {
  const startUrl = new URL(path, entryOrigin).toString();
  const expected = canonicalUrl(path);

  const response = await request.get(startUrl, {
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
export async function assertHttpsFirstRedirect(request, entryOrigin, path) {
  const startUrl = new URL(path, entryOrigin).toString();

  const response = await request.get(startUrl, {
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
