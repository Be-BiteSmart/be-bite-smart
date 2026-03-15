/**
 * video-toggle.js
 * Shared video toggle logic for .video-episode-block and .video-quote-block.
 * Handles play button, thumbnail click, watch button, and language switching
 * (language toggle only runs when the relevant elements are present).
 */
document.addEventListener("DOMContentLoaded", function () {
  const videoBlocks = document.querySelectorAll(
    ".video-episode-block, .video-quote-block",
  );

  videoBlocks.forEach((block) => {
    const thumbnail = block.querySelector(".video-thumbnail");
    const videoPlayer = block.querySelector(".video-player");
    const playButton = block.querySelector(".play-button");
    const watchButton = block.querySelector(
      ".watch-now-button, .video-quote-watch-button",
    );
    const buttonText = watchButton?.querySelector(".button-text");

    // Language toggle — episode-card only
    const toggleLabels = block.querySelectorAll(".toggle-label");
    const languageToggle = block.querySelector(".language-toggle");
    let currentLang = "en";
    let isPlaying = false;

    // ── Load video ────────────────────────────────────────────────────────────
    function loadVideo() {
      // episode-card stores EN/ES ids as data-vimeo-en / data-vimeo-es
      // video-quote stores a single id as data-vimeo-id
      // it tries data-vimeo-en/data-vimeo-es first (episode-card), then falls back to data-vimeo-id (video-quote).
      const vimeoId =
        block.dataset[
          `vimeo${currentLang.charAt(0).toUpperCase() + currentLang.slice(1)}`
        ] || block.dataset.vimeoId;

      if (!vimeoId) {
        console.error("No Vimeo ID found for", currentLang);
        return;
      }

      const iframe = document.createElement("iframe");
      iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      videoPlayer.innerHTML = "";
      videoPlayer.appendChild(iframe);
      thumbnail.classList.add("hidden");
      isPlaying = true;
    }

    // ── Language toggle (episode-card only) ───────────────────────────────────
    // . The language toggle block only runs when .toggle-label elements are found, so it's silently skipped for video-quote.
    if (toggleLabels.length) {
      toggleLabels.forEach((label) => {
        label.addEventListener("click", function (e) {
          e.stopPropagation();
          currentLang = this.dataset.lang;

          // Update active state
          toggleLabels.forEach((l) => l.classList.remove("active"));
          this.classList.add("active");

          // Slide the toggle pill
          if (currentLang === "es") {
            languageToggle.classList.add("es");
          } else {
            languageToggle.classList.remove("es");
          }

          // Update button text
          if (buttonText) {
            buttonText.textContent =
              currentLang === "en" ? "Watch Now" : "Ver Ahora";
          }

          // Reload video if already playing
          if (isPlaying) {
            loadVideo();
          }
        });
      });
    }

    // ── Play button ───────────────────────────────────────────────────────────
    if (playButton) {
      playButton.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        loadVideo();
      });
    }

    // ── Watch button ──────────────────────────────────────────────────────────
    if (watchButton) {
      watchButton.addEventListener("click", function (e) {
        e.preventDefault();
        loadVideo();
      });
    }

    // ── Thumbnail click ───────────────────────────────────────────────────────
    if (thumbnail) {
      thumbnail.addEventListener("click", function (e) {
        e.preventDefault();
        loadVideo();
      });
    }
  });
});
