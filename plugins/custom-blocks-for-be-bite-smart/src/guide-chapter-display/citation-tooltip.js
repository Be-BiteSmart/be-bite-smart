// Accessible hover/focus preview for inline "Cite" citation-ref links —
// added 2026-08-16, see [[be-bitesmart-guide-cpt-plan]] in memory for the
// full citations feature. Each `.citation-ref` link (built server-side by
// bitesmart_resolve_citation_refs(), guide-chapter-display.php) already
// carries its own `data-citation-tooltip` text and a real `href` pointing
// at the References page — this script only ever adds a preview on top;
// it changes nothing about the link's own behavior.
//
// WAI-ARIA tooltip pattern, per Janet's own ask ("if there is a way to do
// that in an accessible way"):
//  - ONE shared tooltip element for the whole page (not one per citation
//    mention) — repositioned/repopulated on each hover/focus, so citing
//    the same source twice on one page never risks a duplicate-id
//    collision the way a per-mention tooltip element would.
//  - Shown on `mouseover` AND `focusin` (not hover-only) — a sighted
//    keyboard user tabbing through the text gets the same preview a mouse
//    user gets by hovering; a screen reader gets the same text announced
//    via `aria-describedby="citation-tooltip"` (already set on every
//    `.citation-ref` link server-side) regardless of whether anyone is
//    currently looking at a visible tooltip bubble at all.
//  - Hidden on `mouseout`/`focusout`/Escape.
//  - Fully degrades with no JS at all, or on a touch device with no hover
//    state to intercept: the citation-ref is a real `<a href>` the entire
//    time, so a click/tap/Enter-key still navigates straight to the
//    References page's anchor for that citation.

const TOOLTIP_ID = "citation-tooltip";

let tooltipEl = null;

function getTooltip() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement("div");
  tooltipEl.id = TOOLTIP_ID;
  tooltipEl.className = "citation-tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function showTooltip(trigger) {
  const text = trigger.dataset.citationTooltip;
  if (!text) return;

  const tooltip = getTooltip();
  // innerHTML, not textContent — citation text is already-sanitized
  // editorial HTML (wp_kses_post() at save time, citation-cpt.php; see the
  // PHP comment at its source), so an italicized journal title still
  // reads that way in the preview, not just on the References page.
  tooltip.innerHTML = text;
  tooltip.hidden = false;

  const rect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  // Above the trigger by default; flips below it if there isn't enough
  // room near the top of the viewport (e.g. a citation early in the page).
  const top =
    rect.top > tooltipRect.height + 12
      ? rect.top + window.scrollY - tooltipRect.height - 8
      : rect.bottom + window.scrollY + 8;
  // Clamped so a citation near the right edge of the viewport doesn't push
  // the tooltip off-screen.
  const left = Math.max(
    8,
    Math.min(
      rect.left + window.scrollX,
      window.scrollX + document.documentElement.clientWidth - tooltipRect.width - 8,
    ),
  );

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function hideTooltip() {
  if (tooltipEl && !tooltipEl.hidden) {
    tooltipEl.hidden = true;
  }
}

// Event-delegated on document (not bound per-link at init) — same reason
// as every other interactive piece of a chapter row (see this folder's own
// format-toggle.js): a citation-ref link can enter the DOM well after
// DOMContentLoaded, e.g. when the pooled search page's Fuse.js swaps in
// newly-matched cards.
document.addEventListener("mouseover", (event) => {
  const trigger = event.target.closest(".citation-ref");
  if (trigger) showTooltip(trigger);
});

document.addEventListener("mouseout", (event) => {
  if (event.target.closest(".citation-ref")) hideTooltip();
});

document.addEventListener("focusin", (event) => {
  const trigger = event.target.closest(".citation-ref");
  if (trigger) showTooltip(trigger);
});

document.addEventListener("focusout", (event) => {
  if (event.target.closest(".citation-ref")) hideTooltip();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideTooltip();
});
