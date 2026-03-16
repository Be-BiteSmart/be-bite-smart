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
            const viewLabel = b.querySelector(".btn-label--view");
            const hideLabel = b.querySelector(".btn-label--hide");
            if (viewLabel) viewLabel.style.display = "";
            if (hideLabel) hideLabel.style.display = "none";
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
          btn.querySelector(".btn-label--view").style.display = "none";
          btn.querySelector(".btn-label--hide").style.display = "";
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
