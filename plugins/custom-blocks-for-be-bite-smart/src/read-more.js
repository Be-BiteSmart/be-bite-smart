(function () {
  // Opens one .expandable-article-block programmatically — the exact same
  // end state the click handler below reaches, just triggered without a
  // click (used by expandForHash() so a deep link always lands with
  // everything visible, not collapsed behind the button).
  function expand(article) {
    // :scope > , not a bare descendant selector — added 2026-08-31, real bug
    // found once custom/books-list nested an Excerpt's own
    // .expandable-article-block (Book Excerpt's Read More) INSIDE a group's
    // .expandable-content for the first time anywhere in this codebase. A
    // bare ".read-more-toggle" search matches the FIRST one anywhere in
    // article's subtree in document order — which is the nested inner
    // book's button (it sits earlier in the DOM, inside .expandable-content)
    // — not the outer group's own visible Show More button, so the real
    // button silently never got a click listener at all. :scope > only ever
    // matches article's own direct children, which every existing usage
    // (this one included) already has both elements as.
    var toggle = article.querySelector(":scope > .read-more-toggle");
    var content = article.querySelector(":scope > .expandable-content");
    if (!toggle || !content) return;

    // Hydrate any lazy cover images (custom/books-list's hidden cards —
    // bitesmart_books_list_make_cover_lazy(), books-list.php) the instant
    // this section actually opens, click or hash-triggered either way, so
    // a card that's never revealed never downloads its cover at all.
    content.querySelectorAll("img[data-src]").forEach(function (img) {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });

    var labelExpanded = toggle.dataset.labelExpanded || "Read Less";
    content.classList.add("expanded");
    toggle.setAttribute("data-expanded", "true");
    toggle.textContent = labelExpanded;
  }

  // Added 2026-08-31 for custom/books-list's Show More/Show Less groups
  // (each instance's own `id="books-list-{audience}"` wrapper is the link
  // target, with its .expandable-article-block nested inside, not ON, that
  // element — see books-list.php) but written generically: it opens every
  // .expandable-article-block that IS the hash target or is nested inside
  // it, so a link straight at a single book's own anchor (article's own id,
  // see bitesmart_book_anchor_id() in book-display.php) auto-opens THAT
  // book's Excerpt Read More too, for free, with no books-list-specific
  // code. A hash that isn't a valid CSS selector (rare, but not every
  // fragment is) is caught rather than throwing.
  function expandForHash() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    var target;
    try {
      target = document.querySelector(hash);
    } catch (e) {
      return;
    }
    if (!target) return;

    if (target.classList.contains("expandable-article-block")) {
      expand(target);
    }
    target.querySelectorAll(".expandable-article-block").forEach(expand);
  }

  function init() {
    document
      .querySelectorAll(".expandable-article-block")
      .forEach(function (article) {
        // :scope > — see the matching comment in expand() above for why.
        var toggle = article.querySelector(":scope > .read-more-toggle");
        var content = article.querySelector(":scope > .expandable-content");
        if (!toggle || !content) return;
        // Per-block overrides (custom/read-more's `buttonLabel` /
        // `expandedButtonLabel` attributes, read-more/index.js). Blank —
        // including on content saved before these data attributes
        // existed — falls back to the hardcoded defaults below, so a
        // custom label now survives every toggle instead of being
        // clobbered by a hardcoded string after the first click.
        var labelCollapsed = toggle.dataset.labelCollapsed || "Read More";

        toggle.addEventListener("click", function () {
          var isExpanded = toggle.getAttribute("data-expanded") === "true";
          if (isExpanded) {
            content.classList.remove("expanded");
            toggle.setAttribute("data-expanded", "false");
            toggle.textContent = labelCollapsed;
            // will scroll back to where they left off on close
            article.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            expand(article);
          }
        });
      });

    expandForHash();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
