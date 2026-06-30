import { expect } from "@playwright/test";

/** Ignore very short placeholder descriptions. */
export const MIN_META_DESCRIPTION_LENGTH = 50;

/** All in One SEO serves `/sitemap.xml` on production; keep fallbacks for other hosts. */
export const SITEMAP_PATHS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/wp-sitemap.xml",
];

const WORDPRESS_ERROR_TITLE = /WordPress.*Error/i;

/**
 * Expected absolute canonical URL for a route under `baseURL`.
 * Matches All in One SEO trailing-slash style on this site.
 */
export function expectedCanonicalHref(baseURL, path) {
  const base = baseURL.replace(/\/$/, "");
  if (path === "/" || path === "") {
    return `${base}/`;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export async function readPageSeo(page) {
  return page.evaluate(() => ({
    title: document.title?.trim() ?? "",
    canonical:
      document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ??
      "",
    description:
      document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ??
      "",
  }));
}

/**
 * Assert core on-page SEO tags on a loaded page.
 * Returns collected values for test attachments.
 */
export async function assertPageSeo(page, { path, label, baseURL }) {
  const seo = await readPageSeo(page);
  const expectedCanonical = expectedCanonicalHref(baseURL, path);

  expect(
    seo.title,
    `${label}: document title is empty`,
  ).not.toEqual("");

  expect(
    seo.title,
    `${label}: WordPress error page title`,
  ).not.toMatch(WORDPRESS_ERROR_TITLE);

  expect(
    seo.canonical,
    `${label}: missing <link rel="canonical">`,
  ).not.toEqual("");

  expect(
    seo.canonical,
    `${label}: canonical should be ${expectedCanonical}, got ${seo.canonical}`,
  ).toBe(expectedCanonical);

  expect(
    seo.description,
    `${label}: missing <meta name="description">`,
  ).not.toEqual("");

  expect(
    seo.description.length,
    `${label}: meta description is too short (${seo.description.length} chars, min ${MIN_META_DESCRIPTION_LENGTH})`,
  ).toBeGreaterThanOrEqual(MIN_META_DESCRIPTION_LENGTH);

  return { ...seo, expectedCanonical };
}

export function parseRobotsTxt(body) {
  const sitemapUrls = [];
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*Sitemap:\s*(\S+)/i);
    if (match) {
      sitemapUrls.push(match[1]);
    }
  }
  return { sitemapUrls };
}

export async function assertRobotsTxt(request, baseURL) {
  let url = "/robots.txt";

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

  const response = await request.get(url, { failOnStatusCode: false });
  const status = response.status();
  const body = await response.text();

  expect(status, `/robots.txt returned HTTP ${status}`).toBe(200);
  expect(body.trim(), "/robots.txt is empty").not.toEqual("");

  const { sitemapUrls } = parseRobotsTxt(body);

  return { status, body, sitemapUrls };
}

export function isSitemapXml(body) {
  const trimmed = body.trim();
  return (
    trimmed.startsWith("<?xml") &&
    (/<urlset[\s>]/i.test(trimmed) || /<sitemapindex[\s>]/i.test(trimmed))
  );
}

/**
 * Returns the first reachable sitemap path and its body.
 */
export async function fetchSitemap(request, baseURL) {
  let lastStatus = 0;

  for (const path of SITEMAP_PATHS) {
    let url = path;

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

    const response = await request.get(url, { failOnStatusCode: false });
    lastStatus = response.status();
    if (lastStatus !== 200) {
      continue;
    }

    const body = await response.text();
    if (isSitemapXml(body)) {
      return { path, status: lastStatus, body };
    }
  }

  return { path: SITEMAP_PATHS[0], status: lastStatus, body: "" };
}

export async function assertSitemap(request, baseURL) {
  const result = await fetchSitemap(request, baseURL);

  expect(
    result.status,
    `sitemap (${SITEMAP_PATHS.join(", ")}) returned HTTP ${result.status}`,
  ).toBe(200);

  expect(
    isSitemapXml(result.body),
    `${result.path} is not a valid sitemap XML document`,
  ).toBe(true);

  return result;
}
