document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".press-release-block").forEach((article) => {
    const toggle = article.querySelector(".read-more-toggle, .pdf-toggle");
    const content = article.querySelector(
      ".expandable-content, .pdf-viewer-container",
    );

    if (!toggle || !content) return;

    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("data-expanded") === "true";
      const isPdf = toggle.classList.contains("pdf-toggle");

      if (isExpanded) {
        // Collapse
        content.classList.remove("expanded");
        toggle.setAttribute("data-expanded", "false");
        toggle.textContent = isPdf ? "View PDF" : "Read More";

        // Scroll back to the top of this article
        article.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // Expand
        content.classList.add("expanded");
        toggle.setAttribute("data-expanded", "true");
        toggle.textContent = isPdf ? "Close PDF" : "Read Less";
      }
    });
  });
});
