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
const LOG_DEBOUNCE_MS = 700; // separate, longer "typing settled" delay before a zero-result search is considered loggable — see maybeLogZeroResult() below
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
  const { lang, restUrl, restNonce } = block.dataset;

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

  // Tracked so maybeLogZeroResult() (below) can tell a genuine "Fuse found
  // nothing" from "Fuse found matches but the type filter hid them all"
  // without re-running Fuse itself — only the former is loggable (see its
  // own comment). lastRawFuseCount stays null (never loggable) whenever no
  // real search has actually run, e.g. the box is empty/below
  // MIN_QUERY_LENGTH.
  let lastQuery = "";
  let lastRawFuseCount = null;

  function render(query) {
    const trimmed = query.trim();
    lastQuery = trimmed;

    if (trimmed.length < MIN_QUERY_LENGTH) {
      lastRawFuseCount = null;
      results.innerHTML = "";
      status.textContent = "";
      if (browse) browse.hidden = false;
      return;
    }

    const rawMatches = fuse.search(trimmed);
    lastRawFuseCount = rawMatches.length;

    const enabledTypes = getEnabledTypes();
    const matches = rawMatches.filter(
      (match) => !enabledTypes || enabledTypes.has(match.item.type),
    );

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

  // Dedup within this one page visit — retyping the same zero-result term
  // (e.g. backspace-and-retype) shouldn't log it again. Naturally resets on
  // reload since it's just in-memory; that's fine, the server-side count in
  // search_log still accumulates across visits.
  const loggedZeroResultTerms = new Set();

  // Fires ~700ms after typing settles (LOG_DEBOUNCE_MS, independent of the
  // 200ms results debounce below) — waiting longer than the results
  // debounce avoids logging every intermediate zero-result state while a
  // parent is still mid-word (e.g. "gro" before "growling"). Only a
  // genuine "Fuse found nothing" counts (lastRawFuseCount === 0) — a
  // search where Fuse found matches but the type-filter checkboxes hid all
  // of them is a filter-UX signal, not a "content doesn't exist" signal,
  // and would be a false positive in the discovery data (see render()'s
  // lastRawFuseCount comment above).
  //
  // Fire-and-forget: this must never affect the visible search UX, so
  // nothing here surfaces success or failure of the log call back to the
  // parent — the .catch(() => {}) exists only to avoid an unhandled-
  // rejection console warning, not to react to failures.
  function maybeLogZeroResult() {
    if (!restUrl || !restNonce) {
      return; // shouldn't happen post-deploy, but never let a missing attribute throw
    }

    // Re-read fresh rather than trusting a value captured when this timer
    // was scheduled — if the parent kept typing and render() hasn't caught
    // up yet, lastQuery/lastRawFuseCount could be stale for the box's
    // current value. Skip this cycle; the next keystroke re-arms the timer
    // and will catch it once things settle.
    const trimmed = input.value.trim();
    if (trimmed !== lastQuery || lastRawFuseCount !== 0) {
      return;
    }

    const key = trimmed.toLowerCase();
    if (loggedZeroResultTerms.has(key)) {
      return;
    }
    loggedZeroResultTerms.add(key);

    fetch(restUrl, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "X-WP-Nonce": restNonce,
      },
      body: JSON.stringify({ term: trimmed, stage: block.dataset.stage, lang }),
    }).catch(() => {});
  }

  let debounceTimer;
  let logDebounceTimer;
  input.addEventListener("input", () => {
    updateClearButton();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => render(input.value), DEBOUNCE_MS);
    clearTimeout(logDebounceTimer);
    logDebounceTimer = setTimeout(maybeLogZeroResult, LOG_DEBOUNCE_MS);
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
