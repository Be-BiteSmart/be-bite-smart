(function () {
  // Finds the .read-more-toggle / .expandable-content that BELONGS to
  // `article` — i.e. the nearest .expandable-article-block ancestor of the
  // match is `article` itself, not some other (nested or ancestor) one.
  //
  // Started as a bare descendant `article.querySelector(selector)` — broke
  // 2026-08-31 once custom/books-list nested an Excerpt's own
  // .expandable-article-block (Book Excerpt's Read More) INSIDE a group's
  // .expandable-content for the first time anywhere in this codebase: the
  // first matching element in document order was the nested inner book's
  // button (it sits earlier in the DOM, inside .expandable-content), not the
  // outer group's own visible Show More button, so the real button silently
  // never got a click listener at all. Switched to `:scope > selector`,
  // which fixed that — every usage at the time had both elements as direct
  // children of the article.
  //
  // That broke again once custom/article-or-commentary's and
  // custom/press-release's "text" mode started wrapping .expandable-content
  // and the button in an extra <div> (so they're grandchildren of the
  // article, not direct children) — `:scope >` no longer found them, so
  // their Read More buttons did nothing. closest() tolerates any wrapper
  // depth while still excluding a nested article's own toggle/content (its
  // closest .expandable-article-block is the nested article, not this one).
  function findOwn(article, selector) {
    var found = null;
    article.querySelectorAll(selector).forEach(function (el) {
      if (!found && el.closest(".expandable-article-block") === article) {
        found = el;
      }
    });
    return found;
  }

  function findOwnExpandableContent(article) {
    return findOwn(article, ".expandable-content");
  }

  function setToggleLabel(toggle, label) {
    var labelElement = toggle.querySelector(".read-more-toggle-label");
    if (labelElement) {
      labelElement.textContent = label;
    } else {
      toggle.textContent = label;
    }
  }

  // Opens one .expandable-article-block programmatically — the exact same
  // end state the click handler below reaches, just triggered without a
  // click (used by expandForHash() so a deep link always lands with
  // everything visible, not collapsed behind the button).
  function expand(article) {
    var toggle = findOwn(article, ".read-more-toggle");
    var content = findOwnExpandableContent(article);
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
    toggle.setAttribute("aria-expanded", "true");
    setToggleLabel(toggle, labelExpanded);
    updateBookCardToggles();
  }

  function setBookCardExpanded(card, expanded) {
    var toggle = card.querySelector(":scope > .book-card-container .book-card-expand-toggle");
    var details = card.querySelector(":scope > .book-card-container .book-card-details-expandable");
    if (!details || !toggle) return;

    var label = expanded
      ? toggle.dataset.labelExpanded
      : toggle.dataset.labelCollapsed;
    details.hidden = !expanded;
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    setToggleLabel(toggle, label || (expanded ? "Show less" : "Show more"));
  }

  function updateBookCardToggle(card) {
    var toggle = card.querySelector(":scope > .book-card-container .book-card-expand-toggle");
    var details = card.querySelector(":scope > .book-card-container .book-card-details-expandable");
    if (!toggle) return;

    toggle.hidden = !details || !details.textContent.trim();
    if (details && toggle.getAttribute("aria-expanded") !== "true") {
      details.hidden = true;
    }
  }

  function updateBookCardToggles() {
    document.querySelectorAll(".book-card-collapsible").forEach(updateBookCardToggle);
  }

  function initBookCards() {
    document.querySelectorAll(".book-card-collapsible").forEach(function (card) {
      var toggle = card.querySelector(":scope > .book-card-container .book-card-expand-toggle");
      var details = card.querySelector(":scope > .book-card-container .book-card-details-expandable");
      if (!toggle || !details || toggle.dataset.initialized === "true") return;

      toggle.dataset.initialized = "true";
      details.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.addEventListener("click", function () {
        var isExpanded = toggle.getAttribute("aria-expanded") === "true";
        setBookCardExpanded(card, !isExpanded);
        if (isExpanded) {
          card.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

      updateBookCardToggle(card);
    });
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

    if (target.classList.contains("book-card-collapsible")) {
      setBookCardExpanded(target, true);
    }
    target.querySelectorAll(".book-card-collapsible").forEach(function (card) {
      setBookCardExpanded(card, true);
    });

    if (target.classList.contains("expandable-article-block")) {
      expand(target);
    }
    target.querySelectorAll(".expandable-article-block").forEach(expand);
  }

  function init() {
    initBookCards();

    document
      .querySelectorAll(".expandable-article-block")
      .forEach(function (article) {
        var toggle = findOwn(article, ".read-more-toggle");
        var content = findOwnExpandableContent(article);
        if (!toggle || !content) return;
        // Per-block overrides (custom/read-more's `buttonLabel` /
        // `expandedButtonLabel` attributes, read-more/index.js). Blank —
        // including on content saved before these data attributes
        // existed — falls back to the hardcoded defaults below, so a
        // custom label now survives every toggle instead of being
        // clobbered by a hardcoded string after the first click.
        var labelCollapsed = toggle.dataset.labelCollapsed || "Read More";
        toggle.setAttribute(
          "aria-expanded",
          toggle.getAttribute("data-expanded") === "true" ? "true" : "false",
        );

        toggle.addEventListener("click", function () {
          var isExpanded = toggle.getAttribute("data-expanded") === "true";
          if (isExpanded) {
            content.classList.remove("expanded");
            toggle.setAttribute("data-expanded", "false");
            toggle.setAttribute("aria-expanded", "false");
            setToggleLabel(toggle, labelCollapsed);
            // will scroll back to where they left off on close
            article.scrollIntoView({ behavior: "smooth", block: "start" });
            updateBookCardToggles();
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
