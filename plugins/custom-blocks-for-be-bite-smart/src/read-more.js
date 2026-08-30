(function () {
  function init() {
    document
      .querySelectorAll(".expandable-article-block")
      .forEach(function (article) {
        var toggle = article.querySelector(".read-more-toggle");
        var content = article.querySelector(".expandable-content");
        if (!toggle || !content) return;
        // Per-block overrides (custom/read-more's `buttonLabel` /
        // `expandedButtonLabel` attributes, read-more/index.js). Blank —
        // including on content saved before these data attributes
        // existed — falls back to the hardcoded defaults below, so a
        // custom label now survives every toggle instead of being
        // clobbered by a hardcoded string after the first click.
        var labelCollapsed = toggle.dataset.labelCollapsed || "Read More";
        var labelExpanded = toggle.dataset.labelExpanded || "Read Less";

        toggle.addEventListener("click", function () {
          var isExpanded = toggle.getAttribute("data-expanded") === "true";
          if (isExpanded) {
            content.classList.remove("expanded");
            toggle.setAttribute("data-expanded", "false");
            toggle.textContent = labelCollapsed;
            // will scroll back to where they left off on close
            article.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            content.classList.add("expanded");
            toggle.setAttribute("data-expanded", "true");
            toggle.textContent = labelExpanded;
          }
        });
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
