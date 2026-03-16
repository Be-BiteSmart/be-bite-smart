(function () {
  function initToggles(buttonSelector, viewerSelector, groupPrefix) {
    document.querySelectorAll(buttonSelector).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-target");
        var groupId = btn.getAttribute("data-group");
        var isOpen = btn.getAttribute("data-expanded") === "true";

        // Close all buttons and viewers in the same group
        document
          .querySelectorAll(buttonSelector + '[data-group="' + groupId + '"]')
          .forEach(function (b) {
            b.setAttribute("data-expanded", "false");
            const bLabel = b.querySelector(".btn-label");
            // The if (bLabel) / if (btnLabel) guards are important — they make sure it gracefully skips any button that doesn't have a .btn-label span (like a "Coming Soon" button or any other toggle on the page that uses the same script).
            if (bLabel)
              bLabel.textContent = bLabel.textContent.replace("Hide", "View");
          });
        document.querySelectorAll(viewerSelector).forEach(function (v) {
          if (v.id && v.id.includes(groupId.replace(groupPrefix, ""))) {
            v.classList.remove("expanded");
          }
        });

        // If it wasn't already open, open it
        if (!isOpen) {
          var viewer = document.getElementById(targetId);
          if (viewer) {
            var iframe = viewer.querySelector("iframe[data-src]");
            if (iframe) {
              iframe.src = iframe.getAttribute("data-src");
              iframe.removeAttribute("data-src");
            }
            viewer.classList.add("expanded");
          }
          btn.setAttribute("data-expanded", "true");
          const btnLabel = btn.querySelector(".btn-label");
          if (btnLabel)
            btnLabel.textContent = btnLabel.textContent.replace("View", "Hide");
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
