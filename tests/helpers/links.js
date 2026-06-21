/**
 * Collect unique same-origin URLs from anchor hrefs on the current page.
 */
export async function collectInternalLinks(page, { origin, maxLinks }) {
  const hrefs = await page.$$eval("a[href]", (anchors) =>
    anchors.map((anchor) => anchor.href).filter(Boolean),
  );

  const seen = new Set();
  const links = [];

  for (const href of hrefs) {
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      continue;
    }
    if (url.origin !== origin) {
      continue;
    }

    url.hash = "";
    const normalized = url.toString();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    links.push(normalized);

    if (links.length >= maxLinks) {
      break;
    }
  }

  return links;
}

/**
 * HEAD first; fall back to GET when servers reject HEAD (common on WordPress).
 */
export async function checkLinkStatus(request, url) {
  let response = await request.fetch(url, { method: "HEAD", maxRedirects: 5 });
  if (response.status() === 405 || response.status() === 501) {
    response = await request.fetch(url, { method: "GET", maxRedirects: 5 });
  }
  return response.status();
}

export function isBrokenLinkStatus(status) {
  return status === 404 || status >= 500;
}
