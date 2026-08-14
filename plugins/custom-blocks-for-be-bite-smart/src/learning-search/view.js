import Fuse from "fuse.js";

// Front-end behavior for custom/learning-search (see learning-search.php's
// render_learning_search_block() for what it renders server-side: the
// search box + inline JSON data blob this reads, and the browse list below
// it, server-rendered with plain ?bs_page=N links as a no-JS fallback —
// once this script runs, renderBrowse() below takes it over so the type
// filter checkboxes can affect it live, without a page reload).
//
// Deliberately NOT a fetch()/REST call: every card for this block's Stage
// is already embedded in the page as a <script type="application/json">
// blob (see bitesmart_render_learning_search_data() in learning-search.php),
// already rendered through the same render_qa_entry_block()/
// render_resource_block() functions used elsewhere on the site — so it's
// already in whatever language the page itself rendered in. A "search
// result" (or browse-list item) here is just one of those same
// already-rendered, already-translated HTML strings being shown; nothing
// is built from scratch in JS.

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;
const BROWSE_PER_PAGE = 10; // mirrors $per_page in render_learning_search_block()

function initLearningSearchBlock(block) {
  const instanceId = block.id;
  const input = block.querySelector(".learning-search-input");
  const clearButton = block.querySelector(".learning-search-clear");
  const status = block.querySelector(".learning-search-status");
  const results = block.querySelector(".learning-search-results");
  const browse = block.querySelector(".learning-search-browse");
  const browseContent = block.querySelector(".learning-search-browse-content");
  const typeCheckboxes = Array.from(
    block.querySelectorAll(".learning-search-type-checkbox"),
  );
  const dataEl = document.getElementById(`${instanceId}-data`);

  if (!input || !results || !dataEl) {
    return;
  }

  let cards = [];
  try {
    cards = JSON.parse(dataEl.textContent);
  } catch {
    return; // malformed/empty data blob — search box stays inert, browse list below still works via its server-rendered ?bs_page=N links
  }

  if (!Array.isArray(cards) || cards.length === 0) {
    return;
  }

  const stringFor = (key, fallback) =>
    block.querySelector(`.learning-search-string[data-key="${key}"]`)?.textContent || fallback;

  const fuse = new Fuse(cards, {
    keys: ["searchText"],
    threshold: 0.35, // some typo/fuzziness tolerance without matching everything
    ignoreLocation: true, // searchText is a long concatenated blob, not a short field
    minMatchCharLength: MIN_QUERY_LENGTH,
  });

  // No checkboxes rendered at all (bitesmart_render_learning_search_type_filter()
  // skips this Stage — fewer than 2 distinct card types present) means
  // "every type is enabled" by definition, same as if they were all checked.
  function getEnabledTypes() {
    if (typeCheckboxes.length === 0) {
      return null; // null = no filtering, everything passes
    }
    return new Set(
      typeCheckboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.type),
    );
  }

  function render(query) {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      results.innerHTML = "";
      status.textContent = "";
      if (browse) browse.hidden = false;
      return;
    }

    const enabledTypes = getEnabledTypes();
    const matches = fuse
      .search(trimmed)
      .filter((match) => !enabledTypes || enabledTypes.has(match.item.type));

    if (matches.length === 0) {
      results.innerHTML = "";
      status.textContent = stringFor("no-results", 'No matches found for "{query}".').replace(
        "{query}",
        trimmed,
      );
    } else {
      results.innerHTML = matches.map((match) => match.item.html).join("");
      const countKey = matches.length === 1 ? "results-count-one" : "results-count-other";
      const countFallback = matches.length === 1 ? "1 result" : "{count} results";
      status.textContent = stringFor(countKey, countFallback).replace("{count}", matches.length);
    }

    // While actively searching, the "browse everything" list below is
    // redundant noise for the parent — hide it, it comes back once the
    // search box is cleared (see the branch above).
    if (browse) browse.hidden = true;
  }

  // Client-side pagination state for the browse list — reset to page 1
  // whenever the type filter changes (see the checkbox listener below), so
  // a parent never lands on a now-out-of-range or unexpectedly-different
  // page after narrowing the filter.
  let browsePage = 1;

  function renderBrowse() {
    if (!browseContent) {
      return; // no cards at all for this Stage — nothing to paginate (render_learning_search_block() still renders the plain "nothing added yet" message server-side in that case)
    }

    const enabledTypes = getEnabledTypes();
    const filtered = enabledTypes
      ? cards.filter((card) => enabledTypes.has(card.type))
      : cards;

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
  }

  // Delegated (not bound per-button) since renderBrowse() replaces
  // browseContent's buttons wholesale on every render.
  if (browseContent) {
    browseContent.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page-action]");
      if (!button) return;
      browsePage += button.dataset.pageAction === "prev" ? -1 : 1;
      renderBrowse();
      browseContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  // A type checkbox affects BOTH the live search results and the browse
  // list — one consistent "I don't want to see this" setting, not two
  // independently-behaving filters (see this file's header comment).
  typeCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      browsePage = 1;
      renderBrowse();
      if (input.value.trim().length >= MIN_QUERY_LENGTH) {
        render(input.value);
      }
    });
  });

  // Shows/hides the clear (X) button — kept separate from the debounced
  // search render below so it reacts instantly to typing, not 200ms late.
  function updateClearButton() {
    if (clearButton) {
      clearButton.hidden = input.value.length === 0;
    }
  }

  function clearSearch() {
    input.value = "";
    updateClearButton();
    render("");
    input.focus(); // so the parent can immediately type a new search
  }

  let debounceTimer;
  input.addEventListener("input", () => {
    updateClearButton();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => render(input.value), DEBOUNCE_MS);
  });

  // Escape-to-clear is a common, expected search-box convention (native
  // type="search" fields even do this natively in some browsers) — worth
  // keeping explicit since the native browser clear affordance is hidden
  // in favor of our own accessible .learning-search-clear button (see
  // style.css), which shouldn't mean losing this keyboard shortcut.
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      event.stopPropagation(); // don't let Escape do something else on the page (e.g. close an unrelated modal)
      clearSearch();
    }
  });

  if (clearButton) {
    clearButton.addEventListener("click", clearSearch);
  }

  updateClearButton(); // covers a value restored by browser autofill/back-forward cache on load
  renderBrowse(); // takes over from the server-rendered ?bs_page=N version — see this file's header comment
}

document.querySelectorAll(".learning-search-block").forEach(initLearningSearchBlock);
