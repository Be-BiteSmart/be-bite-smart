import { test, expect } from "@playwright/test";
import { gotoExpectOk } from "../helpers/page.js";
import { CRITICAL_PAGES } from "../helpers/paths.js";

/**
 * Regression test for a real bug (2026-09-11): custom/article-or-commentary's
 * and custom/press-release's "text" mode wrap `.expandable-content` and the
 * `.read-more-toggle` button in an extra `<div>`, one level deeper than
 * read-more.js's (at the time) direct-child lookup expected — so the button
 * rendered, looked normal, and did nothing on click. Nothing in the existing
 * suite clicked these buttons, so it shipped silently.
 *
 * This scans every critical page for VISIBLE `.read-more-toggle` buttons
 * (skipping ones still hidden behind an unrelated "Show More" group, e.g.
 * custom/books-list's per-audience toggle — that's a different control,
 * covered separately) and clicks each one, asserting the click actually did
 * something: its own `.expandable-content` gained `.expanded`,
 * `data-expanded` flipped to "true", and the button's label changed. Then
 * clicks it again and asserts it collapses back, so a regression that only
 * breaks the second half (e.g. re-collapsing) is caught too.
 *
 * A toggle's own content is the `.expandable-content` that is a direct
 * child of the toggle's own parent element — true whether that parent is
 * the `.expandable-article-block` itself (custom/read-more,
 * book-display.php) or an extra wrapper `<div>` (custom/article-or-commentary,
 * custom/press-release) — and, unlike a bare descendant search, this stays
 * correctly scoped even when a card is nested inside another expandable
 * block's content (custom/books-list nesting a book excerpt).
 */
test.describe("Read More / expandable content toggles", () => {
  for (const { path, label } of CRITICAL_PAGES) {
    test(`${label} (${path}) - Read More buttons expand and collapse their content`, async ({
      page,
    }, testInfo) => {
      await gotoExpectOk(page, path);

      const toggles = page.locator(".read-more-toggle:visible");
      const count = await toggles.count();

      if (count === 0) {
        testInfo.skip();
        return;
      }

      const results = [];

      for (let i = 0; i < count; i++) {
        const toggle = toggles.nth(i);
        const content = toggle
          .locator(
            "xpath=../*[contains(concat(' ', normalize-space(@class), ' '), ' expandable-content ')]",
          )
          .first();

        const labelBefore = (await toggle.textContent())?.trim();

        await expect(
          content,
          `${label}: Read More button #${i} ("${labelBefore}") has no matching .expandable-content sibling`,
        ).toHaveCount(1);

        // Expand
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click();

        await expect(
          content,
          `${label}: Read More button #${i} ("${labelBefore}") click did not expand its content`,
        ).toHaveClass(/expanded/);
        await expect(
          toggle,
          `${label}: Read More button #${i} ("${labelBefore}") did not flip data-expanded after click`,
        ).toHaveAttribute("data-expanded", "true");

        const labelAfterExpand = (await toggle.textContent())?.trim();
        expect(
          labelAfterExpand,
          `${label}: Read More button #${i} label did not change after expanding`,
        ).not.toBe(labelBefore);

        // Collapse back
        await toggle.click();

        await expect(
          content,
          `${label}: Read More button #${i} ("${labelBefore}") did not collapse again on a second click`,
        ).not.toHaveClass(/expanded/);
        await expect(toggle).toHaveAttribute("data-expanded", "false");

        const labelAfterCollapse = (await toggle.textContent())?.trim();
        expect(
          labelAfterCollapse,
          `${label}: Read More button #${i} label did not restore after collapsing`,
        ).toBe(labelBefore);

        results.push({ index: i, labelBefore, labelAfterExpand });
      }

      await testInfo.attach(`read-more-results-${path}`, {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });
    });
  }
});
