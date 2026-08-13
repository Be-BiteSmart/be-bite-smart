import Fuse from "fuse.js";

// Front-end behavior for custom/learning-search (see learning-search.php's
// render_learning_search_block() for what it renders server-side: the
// search box + inline JSON data blob this reads, and the paginated browse
// list below it that this script never touches — that part works with JS
// disabled, plain page-reload links).
//
// Deliberately NOT a fetch()/REST call: every card for this block's Stage
// is already embedded in the page as a <script type="application/json">
// blob (see bitesmart_render_learning_search_data() in learning-search.php),
// already rendered through the same render_qa_entry_block()/
// render_resource_block() functions used elsewhere on the site — so it's
// already in whatever language the page itself rendered in. A "search
// result" here is just one of those same pre-rendered HTML strings being
// shown; nothing is built from scratch in JS.

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

function initLearningSearchBlock(block) {
  const instanceId = block.id;
  const input = block.querySelector(".learning-search-input");
  const status = block.querySelector(".learning-search-status");
  const results = block.querySelector(".learning-search-results");
  const browse = block.querySelector(".learning-search-browse");
  const dataEl = document.getElementById(`${instanceId}-data`);

  if (!input || !results || !dataEl) {
    return;
  }

  let cards = [];
  try {
    cards = JSON.parse(dataEl.textContent);
  } catch {
    return; // malformed/empty data blob — search box stays inert, browse list below still works
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

  function render(query) {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      results.innerHTML = "";
      status.textContent = "";
      if (browse) browse.hidden = false;
      return;
    }

    const matches = fuse.search(trimmed);

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

  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => render(input.value), DEBOUNCE_MS);
  });
}

document.querySelectorAll(".learning-search-block").forEach(initLearningSearchBlock);
