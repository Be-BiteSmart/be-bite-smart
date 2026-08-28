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
import { ensureVimeoSdk } from "./shared/vimeo-sdk";
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

/* Live-swap the subtitle/audio track on an already-playing quote-block
   embed, instead of reloading the video. Only the audio side is special-
   cased for English — it has no "alternate" track of its own, so we revert
   to the original upload audio rather than selecting one by language code.
   Captions work the same way for every language, English included: try to
   enable an English caption track rather than turning captions off.

   Returns a Promise<{ audioOk, captionsOk }> that never rejects, so the
   caller can tell whether the switch fully succeeded, partially succeeded
   (e.g. captions changed but the audio track doesn't exist on this video),
   or completely failed — and react accordingly (see handleLangSegmentClick
   and the pendingLangSwitch path in loadVideo()). */
function switchLiveTrack(player, langCode) {
  const captionsPromise = player.enableTextTrack(langCode).then(
    () => true,
    (err) => {
      console.warn(`No ${langCode} subtitle track on this video`, err);
      return false;
    },
  );

  const audioPromise =
    langCode === "en"
      ? player.selectDefaultAudioTrack().then(
          () => true,
          (err) => {
            console.warn("Could not reset to default audio track", err);
            return false;
          },
        )
      : player.selectAudioTrack(langCode).then(
          () => true,
          (err) => {
            console.warn(`No ${langCode} audio track on this video`, err);
            return false;
          },
        );

  return Promise.all([audioPromise, captionsPromise]).then(
    ([audioOk, captionsOk]) => ({ audioOk, captionsOk }),
  );
}

/* ── Track-unavailable note (quote blocks only) ──
   video-quote.php pre-renders an empty <p class="video-quote-track-note">
   next to the picker; we only ever mutate its text/visibility, never its
   presence, so role="status"/aria-live="polite" on it announces reliably.

   The actual wording lives in a hidden, TranslatePress-translatable block
   printed once in the page footer (see bitesmart_render_video_quote_track_note_templates()
   in includes/site-lang.php) — never in JS — so admins can translate it the
   same way they translate the rest of the block's copy. JS only picks which
   template applies and substitutes the {language} placeholder (langName()
   itself now lives in shared/languages.js, shared with the language-restart
   dialog). */
function getTrackNoteTemplate(kind) {
  return (
    document.querySelector(
      `.video-quote-track-note-template[data-kind="${kind}"]`,
    )?.textContent ?? null
  );
}

function getTrackNoteEl(block) {
  return block.querySelector(".video-quote-track-note");
}

function clearTrackNote(block) {
  const el = getTrackNoteEl(block);
  if (el) {
    el.textContent = "";
    el.classList.remove("is-visible");
  }
}

function showTrackNote(
  block,
  targetLang,
  { audioOk, captionsOk, totalFailure },
) {
  const el = getTrackNoteEl(block);
  if (!el) return;

  const kind = totalFailure
    ? "total"
    : !audioOk
      ? "audio-missing"
      : "captions-missing";
  const name = langName(targetLang);
  const template = getTrackNoteTemplate(kind);

  // Fallback wording if the footer templates are missing for some reason —
  // should always be present once bitesmart_video_quote_needs_track_note_templates()
  // has run for this page.
  const fallback = {
    total: `${name} isn't available for this video yet.`,
    "audio-missing": `${name} captions are on, but dubbed audio isn't available yet for this video.`,
    "captions-missing": `${name} audio is on, but captions aren't available yet for this video.`,
  }[kind];

  el.textContent = template
    ? applyLanguagePlaceholder(template, name)
    : fallback;
  el.classList.add("is-visible");
}

/* ── Play-button label ──
   Always names the currently-selected language next to the verb, e.g.
   "Play (Spanish)" — kept in sync with the picker (called from
   setEpisodeLanguage() below) so it's correct from first paint and after
   every language change, including rollbacks. The wrapper phrase stays
   TranslatePress-translatable the same way the track-note above does: a
   static hidden template with a {language} placeholder, substituted
   client-side with langName() — never a hardcoded per-language string, so
   the button stays legible in the site's own language even when the
   selected video language isn't (see bitesmart_render_play_button_label_templates()
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
   Unlike the track-note above, this is a plain confirmation shown only when
   a language switch actually happens, then faded back out — see this
   function's call sites in handleLangSegmentClick() for exactly which paths
   count as a genuine change (never the initial page-load sync, a rollback,
   or a video-quote track failure/partial-success, which shows the
   track-note instead of this). One timeout per block, keyed in a WeakMap so
   rapid re-toggling restarts the fade instead of stacking timers. */
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

/* Quote blocks don't have a videos map — the picker's own rendered
   segments (built server-side from data-supported-langs) are the source
   of truth for which languages this particular video actually supports. */
function defaultQuoteLang(langSegments, siteLang) {
  const codes = Array.from(langSegments).map((el) => el.dataset.lang);
  if (!codes.length) {
    return "en"; // no picker rendered => only English is supported
  }

  const normalizedSite = normalizeLangCode(siteLang);
  return codes.includes(normalizedSite) ? normalizedSite : "en";
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

    let currentLang = isQuoteBlock
      ? defaultQuoteLang(langSegments, siteLang)
      : defaultEpisodeLang(block, videos, siteLang);
    let playingLang = null;
    let isPlaying = false;
    let player = null; // Vimeo.Player instance, quote blocks only

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

    function loadVideo() {
      const vimeoId = isQuoteBlock
        ? block.dataset.quoteVimeoId
        : videos[currentLang];

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

      if (!isQuoteBlock) {
        playingLang = currentLang;
      } else if (langSegments.length) {
        // Quote blocks with 2+ supported languages: wrap the iframe in a
        // Vimeo.Player so later language clicks can swap tracks live
        // instead of reloading.
        ensureVimeoSdk()
          .then((Vimeo) => {
            player = new Vimeo.Player(iframe);

            // Re-verify whatever language ended up selected (reading
            // currentLang live, not a captured value, so this also covers a
            // click that raced this SDK load — see handleLangSegmentClick).
            // Vimeo silently falls back to its default English audio/
            // captions when a texttrack/audiotrack code baked into the
            // iframe src above doesn't exist on this video — there's no
            // load-time error, so this API call is the only reliable way to
            // catch "picked (or defaulted to) a language before playing
            // that isn't actually available" and correct the UI to match
            // what's really playing.
            const attemptedLang = currentLang;
            switchLiveTrack(player, attemptedLang).then(
              ({ audioOk, captionsOk }) => {
                if (!audioOk && !captionsOk) {
                  setEpisodeLanguage("en");
                  showTrackNote(block, attemptedLang, {
                    audioOk,
                    captionsOk,
                    totalFailure: true,
                  });
                } else if (!audioOk || !captionsOk) {
                  showTrackNote(block, attemptedLang, {
                    audioOk,
                    captionsOk,
                    totalFailure: false,
                  });
                }
              },
            );
          })
          .catch((err) => {
            console.warn("Could not load the Vimeo Player SDK", err);
          });
      }
    }

    function handleLangSegmentClick(lang, triggerEl) {
      const target = normalizeLangCode(lang);

      if (isQuoteBlock) {
        const previousLang = currentLang;
        setEpisodeLanguage(target); // optimistic: active-class only, no reload
        clearTrackNote(block); // clear any stale note on every new attempt

        if (isPlaying && player) {
          switchLiveTrack(player, target).then(({ audioOk, captionsOk }) => {
            if (!audioOk && !captionsOk) {
              // Total failure: roll back the UI to what's actually still playing.
              setEpisodeLanguage(previousLang);
              showTrackNote(block, target, {
                audioOk,
                captionsOk,
                totalFailure: true,
              });
            } else if (!audioOk || !captionsOk) {
              // Partial success: a real switch happened, so stay on the new
              // language, but let the visitor know what's missing.
              showTrackNote(block, target, {
                audioOk,
                captionsOk,
                totalFailure: false,
              });
            } else {
              // Full success: both tracks switched cleanly.
              showLangChangeStatus(block, target);
            }
          });
        } else {
          // Not playing yet, OR playing but the player instance hasn't
          // finished initializing yet (raced loadVideo()'s SDK load): either
          // way, currentLang is already updated, and loadVideo()'s
          // post-player-creation verification step (which reads currentLang
          // live) will confirm/correct it once the player exists — covering
          // both "picked a language before ever pressing play" and this
          // race. Confirm the pick now regardless; if it turns out not to
          // be available, that verification step corrects the UI and shows
          // the track-note itself.
          showLangChangeStatus(block, target);
        }
        return;
      }

      if (!isPlaying) {
        setEpisodeLanguage(target);
        showLangChangeStatus(block, target);
        return;
      }

      if (target === playingLang) {
        return;
      }

      confirmLanguageRestart(target, triggerEl).then(
        (confirmed) => {
          if (!confirmed) {
            setEpisodeLanguage(playingLang);
            return;
          }

          setEpisodeLanguage(target);
          showLangChangeStatus(block, target);
          loadVideo();
        },
      );
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
