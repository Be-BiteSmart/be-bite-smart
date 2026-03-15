(function () {
  function init() {
    document
      .querySelectorAll(".expandable-article-block")
      .forEach(function (article) {
        var toggle = article.querySelector(".read-more-toggle");
        var content = article.querySelector(".expandable-content");
        if (!toggle || !content) return;
        toggle.addEventListener("click", function () {
          var isExpanded = toggle.getAttribute("data-expanded") === "true";
          if (isExpanded) {
            content.classList.remove("expanded");
            toggle.setAttribute("data-expanded", "false");
            toggle.textContent = "Read More";
            // will scroll back to where they left off on close
            article.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            content.classList.add("expanded");
            toggle.setAttribute("data-expanded", "true");
            toggle.textContent = "Read Less";
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
