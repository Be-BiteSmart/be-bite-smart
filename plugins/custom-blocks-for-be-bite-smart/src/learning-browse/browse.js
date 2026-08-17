// Front-end behavior for custom/learning-browse — split OUT of
// custom/learning-search's view.js on 2026-08-16 (see learning-search.php's
// file-level comment for the full "why"). Owns the paginated "All X"
// browse list; no Fuse.js/live-search logic here at all — that stays with
// the sibling custom/learning-search block's own view.js. The type-filter
// checkboxes can render in EITHER block's own output (or both, as of
// 2026-08-16 — see syncTypeCheckboxes() below) so one consistent filter
// setting always governs both blocks regardless of which copy a visitor
// touches or which blocks are actually present on the page.
//
// Deliberately NOT a fetch()/REST call: every card for this block's Stage
// is already embedded in the page as a <script type="application/json">
// blob (bitesmart_render_learning_search_data(), reused as-is from
// learning-search.php by this block's own learning-browse.php), already
// rendered through the same render_qa_entry_block()/render_resource_block()
// functions used elsewhere on the site.

const BROWSE_PER_PAGE = 10; // mirrors $per_page in render_learning_browse_block()

// Same function as view.js's own copy — see that file's comment for the
// full "why" (page-wide, no data-stage scoping; mutates .checked directly
// so it can't loop; each file's own document-level "change" listener reacts
// to the one real event independently, so neither file needs the other).
function syncTypeCheckboxes(source) {
  const type = source.dataset.type;
  document.querySelectorAll(`.learning-search-type-checkbox[data-type="${type}"]`).forEach((cb) => {
    if (cb !== source) cb.checked = source.checked;
  });
}

function initLearningBrowseBlock(block) {
  const instanceId = block.id;
  const browseContent = block.querySelector(".learning-search-browse-content");
  const dataEl = document.getElementById(`${instanceId}-data`);

  if (!browseContent || !dataEl) {
    return;
  }

  let cards = [];
  try {
    cards = JSON.parse(dataEl.textContent);
  } catch {
    return; // malformed/empty data blob — browse list stays as its server-rendered ?bs_page=N version
  }

  if (!Array.isArray(cards) || cards.length === 0) {
    return;
  }

  const stringFor = (key, fallback) =>
    block.querySelector(`.learning-search-string[data-key="${key}"]`)?.textContent || fallback;

  // Reads EVERY .learning-search-type-checkbox on the page (this block's
  // own copy and/or a sibling custom/learning-search block's copy — see
  // file header) rather than just this block's own, now that a checkbox
  // can live in either block's output. syncTypeCheckboxes() keeps every
  // copy's .checked in agreement, so it doesn't matter which one is read.
  // No checkboxes rendered anywhere (bitesmart_render_learning_search_type_filter()
  // skips this Stage — fewer than 2 distinct card types present) means
  // "every type is enabled" by definition, same as if they were all checked.
  function getEnabledTypes() {
    const checkboxes = Array.from(document.querySelectorAll(".learning-search-type-checkbox"));
    if (checkboxes.length === 0) {
      return null; // null = no filtering, everything passes
    }
    return new Set(checkboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.type));
  }

  // Reset to page 1 whenever the type filter changes (see the checkbox
  // listener below), so a visitor never lands on a now-out-of-range or
  // unexpectedly-different page after narrowing the filter.
  let browsePage = 1;

  function renderBrowse() {
    const enabledTypes = getEnabledTypes();
    const filtered = enabledTypes ? cards.filter((card) => enabledTypes.has(card.type)) : cards;

    const totalPages = Math.max(1, Math.ceil(filtered.length / BROWSE_PER_PAGE));
    browsePage = Math.max(1, Math.min(browsePage, totalPages));
    const pageCards = filtered.slice(
      (browsePage - 1) * BROWSE_PER_PAGE,
      browsePage * BROWSE_PER_PAGE,
    );

    if (pageCards.length === 0) {
      browseContent.innerHTML = `<p class="learning-search-empty">${stringFor(
        "browse-empty-filtered",
        "Nothing matches the selected filters.",
      )}</p>`;
      return;
    }

    const list = `<div class="learning-search-browse-list">${pageCards
      .map((card) => card.html)
      .join("")}</div>`;

    let pagination = "";
    if (totalPages > 1) {
      const prevButton =
        browsePage > 1
          ? `<button type="button" class="learning-search-page-link learning-search-prev" data-page-action="prev">${stringFor("browse-prev", "Previous")}</button>`
          : "";
      const nextButton =
        browsePage < totalPages
          ? `<button type="button" class="learning-search-page-link learning-search-next" data-page-action="next">${stringFor("browse-next", "Next")}</button>`
          : "";
      const pageStatus = stringFor("browse-page-status", "Page {current} of {total}")
        .replace("{current}", browsePage)
        .replace("{total}", totalPages);

      pagination = `<nav class="learning-search-pagination" aria-label="${stringFor("browse-pagination-label", "Questions & Resources pages")}">${prevButton}<span class="learning-search-page-status">${pageStatus}</span>${nextButton}</nav>`;
    }

    browseContent.innerHTML = list + pagination;
    // Freshly-inserted card markup starts with the SERVER-rendered default
    // format visibility baked in (every checkbox "on") — this reconciles
    // it against whatever the visitor's global "Show video"/"Show text"
    // checkboxes actually say right now. Optional-chained: this file
    // doesn't assume format-toggle.js is loaded (e.g. a Stage whose card
    // list has zero Guide Chapters still runs this same code path).
    window.bitesmartApplyGuideFormatState?.();
  }

  // Delegated (not bound per-button) since renderBrowse() replaces
  // browseContent's buttons wholesale on every render.
  browseContent.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page-action]");
    if (!button) return;
    browsePage += button.dataset.pageAction === "prev" ? -1 : 1;
    renderBrowse();
    browseContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // A type checkbox affects both THIS block's browse list and the sibling
  // custom/learning-search block's live results — one consistent "I don't
  // want to see this" setting, not independently-behaving filters.
  // Delegated on document (not bound to this block's own checkboxes at
  // init) since a checkbox that should affect THIS list can now live
  // inside a sibling custom/learning-search block instead — see the file
  // header. Syncs every same-type checkbox on the page first, then
  // re-renders using getEnabledTypes()'s now-consistent page-wide read;
  // the search block's own view.js independently listens for the same
  // single "change" event and re-runs its own render(), no coupling
  // between the two files needed.
  document.addEventListener("change", (event) => {
    if (!event.target.classList.contains("learning-search-type-checkbox")) return;
    syncTypeCheckboxes(event.target);
    browsePage = 1;
    renderBrowse();
  });

  renderBrowse(); // takes over from the server-rendered ?bs_page=N version
}

document.querySelectorAll(".learning-browse-block").forEach(initLearningBrowseBlock);
