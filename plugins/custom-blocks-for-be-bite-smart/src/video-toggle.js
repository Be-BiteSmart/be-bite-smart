/**
 * video-toggle.js
 * Shared video toggle logic for .video-episode-block and .video-quote-block.
 * Handles play button, thumbnail click, watch button, and language switching
 * (language toggle only runs when the relevant elements are present).
 *
 * video-quote: one Vimeo ID with multi audio/subtitle tracks — defaults tracks from
 * TranslatePress (data-site-lang on the block, or html/body classes as fallback).
 */

function normalizeVimeoLang(code) {
  if (!code) return "en";
  const c = String(code).toLowerCase();
  if (c === "es" || c.startsWith("es-") || c.startsWith("es_")) return "es";
  return "en";
}

/** TranslatePress sets html lang and body classes like translatepress-es_ES. */
function detectSiteLangFromDocument() {
  const htmlLang = (document.documentElement.lang || "").toLowerCase();
  if (htmlLang.startsWith("es")) return "es";

  const bodyClass = document.body.className.toLowerCase();
  if (
    bodyClass.includes("translatepress-es") ||
    /\btranslatepress-es[_-]/.test(bodyClass)
  ) {
    return "es";
  }

  return "en";
}

function buildVimeoPlayerSrc(vimeoId, lang) {
  const params = new URLSearchParams({ autoplay: "1" });
  if (lang === "es") {
    params.set("texttrack", "es");
    params.set("audiotrack", "es");
  }
  return `https://player.vimeo.com/video/${vimeoId}?${params.toString()}`;
}

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
    const isQuoteBlock = block.classList.contains("video-quote-block");
    const siteLang = normalizeVimeoLang(
      block.dataset.siteLang || detectSiteLangFromDocument(),
    );
    let currentLang = isQuoteBlock ? siteLang : "en";
    let isPlaying = false;

    function setEpisodeLanguage(lang, reloadIfPlaying = false) {
      currentLang = lang;
      toggleLabels.forEach((label) => {
        label.classList.toggle("active", label.dataset.lang === lang);
      });
      if (languageToggle) {
        languageToggle.classList.toggle("es", lang === "es");
      }
      if (buttonText) {
        buttonText.textContent = lang === "en" ? "Watch Now" : "Ver Ahora";
      }
      if (reloadIfPlaying && isPlaying) {
        loadVideo();
      }
    }

    // Episode cards save with EN active; sync toggle UI to TranslatePress on load.
    if (!isQuoteBlock && toggleLabels.length && siteLang === "es") {
      setEpisodeLanguage("es");
    }

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
      iframe.src = buildVimeoPlayerSrc(vimeoId, currentLang);
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
          setEpisodeLanguage(this.dataset.lang, true);
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
