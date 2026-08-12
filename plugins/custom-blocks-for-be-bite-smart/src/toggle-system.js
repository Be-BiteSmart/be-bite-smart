(function () {
  function isMobilePdfFallback() {
    return window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
  }

  function initToggles(buttonSelector, viewerSelector, groupPrefix) {
    document.querySelectorAll(buttonSelector).forEach(function (btn) {
      btn.addEventListener("click", function () {
        const targetId = btn.getAttribute("data-target");
        const groupId = btn.getAttribute("data-group");

        if (isMobilePdfFallback()) {
          const viewer = document.getElementById(targetId);
          const iframe = viewer && viewer.querySelector("iframe[data-src]");
          const pdfUrl = iframe ? iframe.getAttribute("data-src") : null;

          if (pdfUrl) {
            window.open(pdfUrl, "_blank", "noopener,noreferrer");
          }
          return;
        }

        const isOpen = btn.getAttribute("data-expanded") === "true";

        // Close all buttons and viewers in the same group
        document
          .querySelectorAll(buttonSelector + '[data-group="' + groupId + '"]')
          .forEach(function (b) {
            //"data-expanded", "false" this way the pdf can be opened again later. Otherwise its confused when you click the button again because it thinks the pdf is already open
            b.setAttribute("data-expanded", "false");
            const viewLabel = b.querySelector(".btn-label--view");
            const hideLabel = b.querySelector(".btn-label--hide");
            // explicit values instead of "" — "" removes the inline style and hands
            // control back to the stylesheet, which hides .btn-label--hide via CSS
            if (viewLabel) viewLabel.style.display = "inline";
            if (hideLabel) hideLabel.style.display = "none";
          });

        document.querySelectorAll(viewerSelector).forEach(function (v) {
          if (v.id && v.id.includes(groupId.replace(groupPrefix, ""))) {
            v.classList.remove("expanded");
          }
        });

        // If it wasn't already open, open it
        if (!isOpen) {
          const viewer = document.getElementById(targetId);
          if (viewer) {
            const iframe = viewer.querySelector("iframe[data-src]");
            if (iframe) {
              iframe.src = iframe.getAttribute("data-src");
              iframe.removeAttribute("data-src");
            }
            viewer.classList.add("expanded");
          }
          btn.setAttribute("data-expanded", "true");
          // explicit "inline" not "" — "" lets CSS take over which would re-hide the span
          btn.querySelector(".btn-label--view").style.display = "none";
          btn.querySelector(".btn-label--hide").style.display = "inline";
        }
      });
    });
  }

  function init() {
    initToggles(".pdf-toggle", ".pdf-viewer-container", "pdf-group-");

    initToggles(".ecd-toggle", ".ecd-viewer", "ecd-grp-");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
