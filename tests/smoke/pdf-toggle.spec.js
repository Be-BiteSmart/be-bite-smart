import { test, expect } from "@playwright/test";
import { gotoExpectOk } from "../helpers/page.js";
import { CRITICAL_PAGES } from "../helpers/paths.js";
import { spyOnPlausible, getPlausibleCalls } from "../analytics/helpers/plausible.js";

/**
 * Validate a URL string is properly formatted.
 */
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

test.describe("PDF Toggle validation", () => {
  for (const { path, label } of CRITICAL_PAGES) {
    test(`${label} (${path}) - PDF toggle checks`, async ({ page }, testInfo) => {
   
      await gotoExpectOk(page, path);

      const pdfToggleBlocks = page.locator(".pdf-toggle-block");
      const toggleCount = await pdfToggleBlocks.count();

      // Skip test if no pdf-toggle blocks found
      if (toggleCount === 0) {
        testInfo.skip();
        return;
      }

      const results = [];

      for (let i = 0; i < toggleCount; i++) {
        const block = pdfToggleBlocks.nth(i);
        const blockResult = {
          blockIndex: i,
          viewButtons: [],
          downloadLinks: [],
          errors: [],
        };

        // Check for view PDF buttons (both English and Spanish)
        const viewButtons = block.locator(".pdf-toggle");
        const viewButtonCount = await viewButtons.count();

        if (viewButtonCount === 0) {
          blockResult.errors.push("No view PDF buttons found");
        } else {
          for (let j = 0; j < viewButtonCount; j++) {
            const btn = viewButtons.nth(j);
            const buttonText = await btn.textContent();
            const dataTestId = await btn.getAttribute("data-testid");

            // Find corresponding iframe to validate URL
            // data-testid format: pdf-btn-en-{blockId} or pdf-btn-es-{blockId}
            // iframe data-testid format: pdf-viewer-en-{blockId} or pdf-viewer-es-{blockId}
            let iframeSelector = ".pdf-viewer-container";
            if (dataTestId) {
              const parts = dataTestId.split("-");
              if (parts.length >= 4) {
                const lang = parts[2]; // "en" or "es"
                const blockId = parts.slice(3).join("-"); // rest is blockId
                iframeSelector = `[data-testid="pdf-viewer-${lang}-${blockId}"]`;
              }
            }
            
            const iframeContainer = block.locator(iframeSelector).first();
            const iframe = iframeContainer.locator("iframe").first();
            const iframeSrc = await iframe.getAttribute("data-src");

            if (!isValidUrl(iframeSrc)) {
              blockResult.errors.push(`View button "${buttonText?.trim()}" has invalid iframe URL: ${iframeSrc}`);
            }

            // Spy on Plausible to intercept analytics events (prevents sending to actual service)
            await spyOnPlausible(page);
            
            // Click the button to verify it works (iframe should become visible)
            await btn.click();
            
            // Wait a moment for the iframe to load/become visible
            await page.waitForTimeout(500);
            
            // Check if the iframe container is now visible
            const isVisible = await iframeContainer.isVisible();
            
            // Check if the iframe src attribute is set (not just data-src)
            // The component may lazy-load the src on click
            const iframeSrcAfterClick = await iframe.getAttribute("src");
            const hasSrcAfterClick = isValidUrl(iframeSrcAfterClick);
            
            // Get intercepted Plausible calls to verify event was captured
            const plausibleCalls = await getPlausibleCalls(page);
            
            blockResult.viewButtons.push({
              text: buttonText?.trim(),
              hasValidUrl: isValidUrl(iframeSrc),
              url: iframeSrc,
              clickWorked: isVisible,
              iframeSrcAfterClick: iframeSrcAfterClick,
              hasSrcAfterClick: hasSrcAfterClick,
              plausibleEvent: plausibleCalls.length > 0 ? plausibleCalls[0] : null,
            });

            if (!isVisible) {
              blockResult.errors.push(`View button "${buttonText?.trim()}" click did not make iframe visible`);
            }
            
            if (!hasSrcAfterClick && isValidUrl(iframeSrc)) {
              blockResult.errors.push(`View button "${buttonText?.trim()}" click did not set iframe src (data-src exists but src not set)`);
            }
          }
        }

        // Check for download links
        const downloadLinks = block.locator(".download-card-pdf-download");
        const downloadLinkCount = await downloadLinks.count();

        if (downloadLinkCount === 0) {
          blockResult.errors.push("No download links found");
        } else {
          for (let j = 0; j < downloadLinkCount; j++) {
            const link = downloadLinks.nth(j);
            const linkText = await link.textContent();
            const href = await link.getAttribute("href");

            if (!isValidUrl(href)) {
              blockResult.errors.push(`Download link "${linkText?.trim()}" has invalid URL: ${href}`);
            }

            blockResult.downloadLinks.push({
              text: linkText?.trim(),
              hasValidUrl: isValidUrl(href),
              url: href,
            });
          }
        }

        // Edge case: pdf-toggle exists but has no valid elements
        if (blockResult.errors.length > 0 && 
            blockResult.viewButtons.length === 0 && 
            blockResult.downloadLinks.length === 0) {
          throw new Error(
            `PDF toggle block ${i} on ${path} has no valid view PDF or download buttons. ` +
            `Errors: ${blockResult.errors.join(", ")}`
          );
        }

        results.push(blockResult);
      }

      // Attach results for debugging
      await testInfo.attach(`pdf-toggle-results-${path}`, {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });

      // Assert no critical errors (blocks without any valid elements)
      for (const result of results) {
        expect(
          result.errors.filter(e => e.includes("No view") || e.includes("No download")),
          `PDF toggle block on ${path} has errors: ${result.errors.join(", ")}`
        ).toHaveLength(0);
      }
    });
  }
});
