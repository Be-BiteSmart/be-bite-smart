import Fuse from "fuse.js";

// Front-end behavior for custom/learning-search — the search box + live
// Fuse.js results, as of the 2026-08-16 split (see learning-search.php's
// file-level comment for the full "why"). The paginated "All X" browse
// list this used to also own now lives in the sibling custom/learning-
// browse block instead (browse.js). The type-filter checkboxes can render
// in EITHER block's own output (or both) — see getEnabledTypes() and
// syncTypeCheckboxes() below for how this file keeps every copy on the
// page in sync and correctly applies whichever one a visitor touches,
// wherever it lives.
//
// Deliberately NOT a fetch()/REST call: every card for this block's Stage
// is already embedded in the page as a <script type="application/json">
// blob (see bitesmart_render_learning_search_data() in learning-search.php),
// already rendered through the same render_qa_entry_block()/
// render_resource_block() functions used elsewhere on the site — so it's
// already in whatever language the page itself rendered in. A "search
// result" here is just one of those same already-rendered,
// already-translated HTML strings being shown; nothing is built from
// scratch in JS.

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;
const LOG_DEBOUNCE_MS = 700; // separate, longer "typing settled" delay before a zero-result search is considered loggable — see maybeLogZeroResult() below

// Keeps every .learning-search-type-checkbox with the same data-type in
// sync with whichever one a visitor just toggled — this block's own copy
// (added 2026-08-16) and/or a sibling custom/learning-browse block's copy,
// however many of each are on the page. Assumes one Stage's worth of
// checkboxes per page (this codebase's existing convention — see e.g.
// custom/learning-search being "placed once per Stage archive page"), so
// no data-stage scoping here, same as format-toggle.js's own page-wide
// .guide-format-checkbox sync. Mutating .checked directly (not
// dispatchEvent) is deliberate — it doesn't fire another "change" event, so
// this can't loop; browse.js has its own identical copy of this function
// and its own document-level listener that reacts to the SAME single
// genuine change event, so both files' effects (live search + browse list)
// stay correct without either file needing to know the other exists.
function syncTypeCheckboxes(source) {
  const type = source.dataset.type;
  document.querySelectorAll(`.learning-search-type-checkbox[data-type="${type}"]`).forEach((cb) => {
    if (cb !== source) cb.checked = source.checked;
  });
}

function initLearningSearchBlock(block) {
  const input = block.querySelector(".learning-search-input");
  const clearButton = block.querySelector(".learning-search-clear");
  const status = block.querySelector(".learning-search-status");
  const results = block.querySelector(".learning-search-results");
  const dataEl = document.getElementById(`${block.id}-data`);
  const { lang, restUrl, restNonce } = block.dataset;

  if (!input || !results || !dataEl) {
    return;
  }

  let cards = [];
  try {
    cards = JSON.parse(dataEl.textContent);
  } catch {
    return; // malformed/empty data blob — search box stays inert
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

  // Type-filter checkboxes can render in THIS block's own output AND in a
  // sibling custom/learning-browse block's output (both call
  // bitesmart_render_learning_search_type_filter() independently — see
  // learning-search.php). Reading every copy on the page and keeping them
  // all in sync (see syncTypeCheckboxes() below) means it doesn't matter
  // which copy a visitor actually touches, or whether a browse block is
  // even present — recomputed fresh on every call (cheap — a couple of
  // querySelectors, not a hot loop). Degrades to null ("no filtering") on
  // a page with no type-filter checkboxes at all — e.g. the pooled Guide
  // search page, which is 100% one type so the filter never renders there.
  function getEnabledTypes() {
    const checkboxes = Array.from(document.querySelectorAll(".learning-search-type-checkbox"));

    if (checkboxes.length === 0) {
      return null; // no filtering, everything passes
    }
    return new Set(checkboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.type));
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
      // Freshly-inserted card markup starts with the SERVER-rendered
      // default format visibility baked in (every checkbox "on") — this
      // reconciles it against whatever the visitor's global "Show video"/
      // "Show text" checkboxes actually say right now. Optional-chained:
      // this file doesn't assume format-toggle.js is loaded (e.g. a Stage
      // whose card list has zero Guide Chapters still runs this same code
      // path). See window.bitesmartApplyGuideFormatState's own comment in
      // format-toggle.js for why this hook exists.
      window.bitesmartApplyGuideFormatState?.();
      const countKey = matches.length === 1 ? "results-count-one" : "results-count-other";
      const countFallback = matches.length === 1 ? "1 result" : "{count} results";
      status.textContent = stringFor(countKey, countFallback).replace("{count}", matches.length);
    }
  }

  // Type-filter checkboxes aren't guaranteed to live inside `block` (a
  // sibling custom/learning-browse block can have its own copy too), so
  // this is delegated on document rather than bound to specific checkbox
  // elements at init. Syncs every same-type checkbox on the page first
  // (see syncTypeCheckboxes() above), then re-runs the search using
  // getEnabledTypes()'s now-consistent page-wide read.
  document.addEventListener("change", (event) => {
    if (!event.target.classList.contains("learning-search-type-checkbox")) return;
    syncTypeCheckboxes(event.target);
    if (input.value.trim().length >= MIN_QUERY_LENGTH) {
      render(input.value);
    }
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
}

document.querySelectorAll(".learning-search-block").forEach(initLearningSearchBlock);
