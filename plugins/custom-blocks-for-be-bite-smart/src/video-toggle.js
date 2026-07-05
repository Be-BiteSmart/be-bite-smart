/**
 * video-toggle.js
 * Shared video logic for .video-episode-block and .video-quote-block.
 */

import {
  detectSiteLangFromDocument,
  normalizeLangCode,
  parseJsonDataset,
  resolveVideosForBlock,
} from "./shared/languages";
import { confirmLanguageRestart } from "./video-lang-restart-modal";

/* ── Vimeo connection warm-up ──
   Opens the DNS/TLS connection to Vimeo's CDNs before the click happens,
   so only the actual video request is left once the iframe is inserted.
   Fires once per page load, right before the first thumbnail (of however
   many are on the page) scrolls within 200px of the viewport. */
let vimeoWarmed = false;

function warmUpVimeoOnce() {
  if (vimeoWarmed) return;
  vimeoWarmed = true;

  ["https://player.vimeo.com", "https://i.vimeocdn.com", "https://f.vimeocdn.com"].forEach(
    (url) => {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = url;
      document.head.appendChild(link);
    },
  );
}

const vimeoWarmUpObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) warmUpVimeoOnce();
    });
  },
  { rootMargin: "200px" },
);

function buildVimeoPlayerSrc(vimeoId, lang) {
  const params = new URLSearchParams({ autoplay: "1" });
  const code = normalizeLangCode(lang);

  if (code === "es") {
    params.set("texttrack", "es");
    params.set("audiotrack", "es");
  } else if (code === "hi") {
    params.set("texttrack", "hi");
    params.set("audiotrack", "hi");
  }

  return `https://player.vimeo.com/video/${vimeoId}?${params.toString()}`;
}

function getLangSegments(block) {
  const segments = block.querySelectorAll(".lang-segment");
  if (segments.length) {
    return segments;
  }
  return block.querySelectorAll(".toggle-label");
}

function getLangPicker(block) {
  return block.querySelector(".episode-lang-picker, .language-toggle");
}

function defaultEpisodeLang(block, videos, siteLang) {
  const codes = Object.keys(videos);
  if (!codes.length) {
    return "en";
  }

  const normalizedSite = normalizeLangCode(siteLang);
  if (videos[normalizedSite]) {
    return normalizedSite;
  }

  if (videos.en) {
    return "en";
  }

  return codes[0];
}

function updatePickerIndex(picker, segments, activeLang) {
  if (!picker || !segments.length) {
    return;
  }

  const codes = Array.from(segments).map((el) => el.dataset.lang);
  const index = Math.max(0, codes.indexOf(activeLang));

  if (picker.classList.contains("episode-lang-picker")) {
    picker.style.setProperty("--lang-count", String(codes.length));
    picker.style.setProperty("--lang-index", String(index));
  } else if (picker.classList.contains("language-toggle")) {
    picker.classList.toggle("es", activeLang === "es");
  }
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

    const langSegments = getLangSegments(block);
    const langPicker = getLangPicker(block);
    const isQuoteBlock = block.classList.contains("video-quote-block");
    const siteLang = normalizeLangCode(
      block.dataset.siteLang || detectSiteLangFromDocument(),
    );
    const videos = resolveVideosForBlock(block);
    const watchLabels = parseJsonDataset(block.dataset.watchLabels, {
      en: "Watch Now",
      es: "Ver Ahora",
      hi: "अभी देखें",
    });

    let currentLang = isQuoteBlock
      ? siteLang
      : defaultEpisodeLang(block, videos, siteLang);
    let playingLang = null;
    let isPlaying = false;

    // Warm up Vimeo's connection once this thumbnail is close to view —
    // one shared observer/flag handles every block on the page.
    if (thumbnail) {
      vimeoWarmUpObserver.observe(thumbnail);
    }

    function setEpisodeLanguage(lang) {
      currentLang = normalizeLangCode(lang);

      langSegments.forEach((segment) => {
        segment.classList.toggle("active", segment.dataset.lang === currentLang);
      });

      updatePickerIndex(langPicker, langSegments, currentLang);

      if (buttonText) {
        buttonText.textContent =
          watchLabels[currentLang] ?? watchLabels.en ?? "Watch Now";
      }
    }

    if (!isQuoteBlock && langSegments.length) {
      setEpisodeLanguage(currentLang);
    }

    function loadVideo() {
      const vimeoId = isQuoteBlock
        ? block.dataset.vimeoId
        : videos[currentLang];

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

      if (!isQuoteBlock) {
        playingLang = currentLang;
      }
    }

    function handleLangSegmentClick(lang, triggerEl) {
      const target = normalizeLangCode(lang);

      if (isQuoteBlock) {
        setEpisodeLanguage(target);
        return;
      }

      if (!isPlaying) {
        setEpisodeLanguage(target);
        return;
      }

      if (target === playingLang) {
        return;
      }

      confirmLanguageRestart(playingLang, target, triggerEl).then((confirmed) => {
        if (!confirmed) {
          setEpisodeLanguage(playingLang);
          return;
        }

        setEpisodeLanguage(target);
        loadVideo();
      });
    }

    if (langSegments.length) {
      langSegments.forEach((segment) => {
        segment.addEventListener("click", function (e) {
          e.stopPropagation();
          handleLangSegmentClick(this.dataset.lang, this);
        });
      });
    }

    if (playButton) {
      playButton.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        loadVideo();
      });
    }

    if (watchButton) {
      watchButton.addEventListener("click", function (e) {
        e.preventDefault();
        loadVideo();
      });
    }

    if (thumbnail) {
      thumbnail.addEventListener("click", function (e) {
        e.preventDefault();
        loadVideo();
      });
    }
  });
});