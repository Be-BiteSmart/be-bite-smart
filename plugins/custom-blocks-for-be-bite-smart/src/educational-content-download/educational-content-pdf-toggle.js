/**
 * ecd-toggle.js
 * Toggle logic for .educational-content-download-block.
 * Self-contained — no dependency on pdf-toggle.js.
 */
(function () {
  function init() {
    document.querySelectorAll(".ecd-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-target");
        var groupId = btn.getAttribute("data-group");
        var isOpen = btn.getAttribute("data-expanded") === "true";

        // Close everything else in the same group
        document
          .querySelectorAll('[data-group="' + groupId + '"]')
          .forEach(function (b) {
            b.setAttribute("data-expanded", "false");
            b.textContent = b.textContent.replace("Hide", "View");
          });
        document.querySelectorAll(".ecd-viewer").forEach(function (v) {
          if (v.id && v.id.includes(groupId.replace("ecd-grp-", ""))) {
            v.classList.remove("expanded");
          }
        });

        // If it wasn't already open, open it
        if (!isOpen) {
          var viewer = document.getElementById(targetId);
          if (viewer) {
            // Lazy-load iframe src on first open
            var iframe = viewer.querySelector("iframe[data-src]");
            if (iframe) {
              iframe.src = iframe.getAttribute("data-src");
              iframe.removeAttribute("data-src");
            }
            viewer.classList.add("expanded");
          }
          btn.setAttribute("data-expanded", "true");
          btn.textContent = btn.textContent.replace("View", "Hide");
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
