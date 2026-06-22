import { expect } from "@playwright/test";

/**
 * Convert a page href to a request path relative to the configured baseURL when same-origin.
 * Leaves absolute off-origin URLs intact so Playwright request can fetch them directly.
 */
export function requestTargetForHref(href, baseURL) {
  const url = new URL(href, baseURL);
  const base = new URL(baseURL);

  if (url.origin === base.origin) {
    return `${url.pathname}${url.search}`;
  }

  return url.toString();
}

export async function collectDownloadLinks(page, selector) {
  return page.locator(selector).evaluateAll((links) =>
    links.map((link) => ({
      text: link.textContent?.trim().replace(/\s+/g, " ") ?? "",
      href: link.getAttribute("href") ?? "",
      download: link.getAttribute("download"),
      dataLang: link.getAttribute("data-lang"),
    })),
  );
}

async function tryHeadThenGet(request, target) {
  const head = await request.fetch(target, {
    method: "HEAD",
    failOnStatusCode: false,
    maxRedirects: 10,
  });

  if (head.status() !== 405 && head.status() !== 501) {
    return { response: head, method: "HEAD" };
  }

  const get = await request.get(target, {
    failOnStatusCode: false,
    maxRedirects: 10,
  });
  return { response: get, method: "GET" };
}

/**
 * Verify a downloadable URL responds like a real file.
 */
export async function assertDownloadResponse(
  request,
  href,
  { baseURL, expectedMimePrefixes, label },
) {
  const target = requestTargetForHref(href, baseURL);
  const { response, method } = await tryHeadThenGet(request, target);
  const status = response.status();
  const contentType = response.headers()["content-type"] ?? "";
  const contentLength = response.headers()["content-length"] ?? "";
  const contentDisposition = response.headers()["content-disposition"] ?? "";

  expect(status, `${label}: ${href} returned HTTP ${status}`).toBe(200);

  expect(
    expectedMimePrefixes.some((prefix) => contentType.startsWith(prefix)),
    `${label}: ${href} returned content-type ${contentType}; expected one of ${expectedMimePrefixes.join(", ")}`,
  ).toBe(true);

  if (contentLength) {
    expect(
      Number.parseInt(contentLength, 10),
      `${label}: ${href} returned invalid content-length ${contentLength}`,
    ).toBeGreaterThan(0);
  }

  return {
    href,
    target,
    method,
    status,
    contentType,
    contentLength,
    contentDisposition,
  };
}
