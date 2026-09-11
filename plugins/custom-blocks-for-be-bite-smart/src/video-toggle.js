/**
 * video-toggle.js
 * Shared video logic for .video-episode-block and .video-quote-block.
 */

import {
  applyLanguagePlaceholder,
  detectSiteLangFromDocument,
  langName,
  normalizeLangCode,
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

  [
    "https://player.vimeo.com",
    "https://i.vimeocdn.com",
    "https://f.vimeocdn.com",
  ].forEach((url) => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = url;
    document.head.appendChild(link);
  });
}

const vimeoWarmUpObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) warmUpVimeoOnce();
    });
  },
  { rootMargin: "200px" },
);

/* ── Play-button label ──
   Always names the currently-selected language next to the verb, e.g.
   "Play (Spanish)" — kept in sync with the picker (called from
   setEpisodeLanguage() below) so it's correct from first paint and after
   every language change, including rollbacks. The wrapper phrase stays
   TranslatePress-translatable the same way the rest of this block's copy
   does: a static hidden template with a {language} placeholder,
   substituted client-side with langName() — never a hardcoded per-language
   string, so the button stays legible in the site's own language even when
   the selected video language isn't (see bitesmart_render_play_button_label_templates()
   in includes/site-lang.php for why that distinction matters here). */
function getPlayButtonLabelTemplate() {
  return (
    document.querySelector(".play-button-label-template")?.textContent ??
    null
  );
}

function setPlayButtonLabel(block, code) {
  const el = block.querySelector(".play-button-label");
  if (!el) return;

  const name = langName(code);
  const template = getPlayButtonLabelTemplate();
  el.textContent = template
    ? applyLanguagePlaceholder(template, name)
    : `Play (${name})`;
}

/* ── Transient "language changed" status ──
   A plain confirmation shown only when a language switch actually happens,
   then faded back out — see this function's call sites in
   handleLangSegmentClick() for exactly which paths count as a genuine
   change (never the initial page-load sync or a cancelled restart). One
   timeout per block, keyed in a WeakMap so rapid re-toggling restarts the
   fade instead of stacking timers. */
const langChangeStatusTimeouts = new WeakMap();
const LANG_CHANGE_STATUS_VISIBLE_MS = 2500;

function getLangChangeStatusTemplate() {
  return (
    document.querySelector(".lang-change-status-template")?.textContent ??
    null
  );
}

function showLangChangeStatus(block, code) {
  const el = block.querySelector(".lang-change-status");
  if (!el) return;

  const name = langName(code);
  const template = getLangChangeStatusTemplate();
  el.textContent = template
    ? applyLanguagePlaceholder(template, name)
    : `Switched to ${name}.`;
  el.classList.add("is-visible");

  clearTimeout(langChangeStatusTimeouts.get(block));
  langChangeStatusTimeouts.set(
    block,
    setTimeout(() => {
      el.classList.remove("is-visible");
    }, LANG_CHANGE_STATUS_VISIBLE_MS),
  );
}

function buildVimeoPlayerSrc(vimeoId, lang, { forceCaptions = false } = {}) {
  // forceCaptions defaults to false to preserve episode-card's existing behavior
  // (captions off on first play). Video-quote blocks explicitly pass true to enable
  // captions from the start. This keeps the new feature isolated to video-quote.
  const params = new URLSearchParams({ autoplay: "1" });
  const code = normalizeLangCode(lang);

  if (code === "es") {
    params.set("texttrack", "es");
    params.set("audiotrack", "es");
  } else if (code === "hi") {
    params.set("texttrack", "hi");
    params.set("audiotrack", "hi");
  } else if (forceCaptions) {
    // English has no alternate audio track to request, but quote blocks
    // want captions on from the first play regardless of language.
    params.set("texttrack", code);
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

function defaultVideoLang(block, videos, siteLang) {
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

    const langSegments = getLangSegments(block);
    const langPicker = getLangPicker(block);
    const isQuoteBlock = block.classList.contains("video-quote-block");
    const siteLang = normalizeLangCode(
      block.dataset.siteLang || detectSiteLangFromDocument(),
    );
    const videos = resolveVideosForBlock(block);

    let currentLang = defaultVideoLang(block, videos, siteLang);
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
        segment.classList.toggle(
          "active",
          segment.dataset.lang === currentLang,
        );
      });

      updatePickerIndex(langPicker, langSegments, currentLang);
      setPlayButtonLabel(block, currentLang);
    }

    if (langSegments.length) {
      setEpisodeLanguage(currentLang);
    }

    /* Both block types load the same way: build the iframe src for
       currentLang and drop it in, replacing anything already there.
       video-quote and video-episode used to diverge here (video-quote
       wrapped the iframe in a Vimeo.Player to live-switch tracks in place
       instead of reloading) — that approach turned out to be unreliable
       (Vimeo's selectAudioTrack()/enableTextTrack() API frequently resolves
       without actually applying the change; see be-bitesmart-video-toggle-
       audio-hang.md for the full investigation) and was replaced 2026-09-10
       with this same reload-on-switch approach episode-card already used
       successfully, via handleLangSegmentClick()'s confirmLanguageRestart()
       call below. */
    function loadVideo() {
      const vimeoId = videos[currentLang];

      if (!vimeoId) {
        console.error("No Vimeo ID found for", currentLang);
        return;
      }

      const iframe = document.createElement("iframe");
      iframe.src = buildVimeoPlayerSrc(vimeoId, currentLang, {
        forceCaptions: isQuoteBlock,
      });
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      videoPlayer.innerHTML = "";
      videoPlayer.appendChild(iframe);
      thumbnail.classList.add("hidden");
      isPlaying = true;
      playingLang = currentLang;
    }

    async function handleLangSegmentClick(lang, triggerEl) {
      const target = normalizeLangCode(lang);

      if (!isPlaying) {
        setEpisodeLanguage(target);
        showLangChangeStatus(block, target);
        return;
      }

      if (target === playingLang) {
        return;
      }

      const confirmed = await confirmLanguageRestart(target, triggerEl);
      if (!confirmed) {
        setEpisodeLanguage(playingLang);
        return;
      }

      setEpisodeLanguage(target);
      showLangChangeStatus(block, target);
      loadVideo();
    }

    if (langSegments.length) {
      langSegments.forEach((segment) => {
        segment.addEventListener("click", function (e) {
          e.stopPropagation();
          handleLangSegmentClick(this.dataset.lang, this);
        });
      });
    }

    // These two are both "start playback" triggers — once a video is
    // already playing, clicking either of them again should do nothing
    // rather than tear down and rebuild the iframe from scratch (loadVideo()
    // always replaces videoPlayer's contents unconditionally). This is
    // separate from the confirmed-language-restart path in
    // handleLangSegmentClick(), which calls loadVideo() directly and
    // deliberately still reloads. playButton's label span is just a DOM
    // child of the button — a click on it bubbles here normally, no
    // separate handling needed.
    if (playButton) {
      playButton.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (isPlaying) return;
        loadVideo();
      });
    }

    if (thumbnail) {
      thumbnail.addEventListener("click", function (e) {
        e.preventDefault();
        if (isPlaying) return;
        loadVideo();
      });
    }
  });
});
