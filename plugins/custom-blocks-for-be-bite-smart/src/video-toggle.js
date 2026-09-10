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

/* Temporary, deliberately verbose debugging aid for the live-language-switch
   investigation (2026-09-10) — every function that touches switching the
   documentary's live audio/caption track logs through this, tagged so it's
   easy to filter in devtools (console filter box: "[lang-switch]") and easy
   to find and strip later (grep the whole file for logLangSwitch). Remove
   once the investigation is done. */
function logLangSwitch(...args) {
  console.log("[lang-switch]", ...args);
}

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
   and the pendingLangSwitch path in loadVideo()).

   The two sub-calls run ONE AFTER ANOTHER, not concurrently — captions
   first, then audio only once captions have settled. Confirmed by a direct
   A/B on an identically warmed-up player 2026-09-10: enableTextTrack() and
   selectAudioTrackForLanguage() fired together via Promise.all (the
   original approach) succeeded only 1/5 times; the same two calls run
   sequentially succeeded 4/5 times, matching the rate measured with audio
   called alone. This corrects an earlier same-day conclusion that
   concurrency didn't matter — that test was confounded by an immediately-
   constructed player, which failed almost regardless of ordering and
   masked the effect. Why concurrency itself makes a difference here isn't
   confirmed (maybe the SDK's postMessage bridge only reliably handles one
   in-flight track-change request at a time this early in a video's life),
   but the measured effect is real and repeatable.

   Each sub-call is still raced against a timeout independently
   (audioOk/captionsOk false if it fires) rather than awaited directly, for
   the same reason as before: called too soon after `new Vimeo.Player(iframe)`
   — before the SDK's postMessage bridge is actually ready, which takes
   longer on a heavier page — the audio-track call can silently hang forever
   (never resolve OR reject), not just fail fast. enableTextTrack() wasn't
   observed doing this, but it's timed the same way defensively, since a
   hung caller here previously produced the visible bug: a language toggle
   that appears to do nothing at all (no status, no track-note) because the
   caller's own .then() never ran. Because the calls are now sequential
   rather than raced together, the true worst case is additive — up to
   TRACK_SWITCH_TIMEOUT_MS for captions, then up to another full
   TRACK_SWITCH_TIMEOUT_MS for audio — not a single shared ~8s ceiling, even
   though this is still the value that also gates how long the language
   picker stays disabled and the loading overlay stays visible per call
   (raised from an original 4000ms so a genuinely slow-but-real Vimeo
   response has room to succeed instead of falling back, now that a longer
   wait reads as "loading" rather than "broken"). */
const TRACK_SWITCH_TIMEOUT_MS = 8000;

/* selectAudioTrack()/selectDefaultAudioTrack() can hang and never settle at
   all — confirmed 2026-09-10, not just on a freshly-constructed player (the
   original hang bug this file already works around via PLAYER_WARMUP_MS),
   but on an already-established, already-playing one too: Janet clicked
   back to English mid-playback, selectDefaultAudioTrack() never resolved
   or rejected within the full TRACK_SWITCH_TIMEOUT_MS, and the switch was
   reported as a failure — even though she was already correctly hearing
   and reading English. The switch had genuinely already succeeded; our own
   code just never got to check, because verifying real state
   (getAudioTracks(), which has never been observed to hang in any testing
   this session) was gated behind that one unreliable promise settling
   first. This is the grace period switchLiveTrack() gives the select call
   before checking real state anyway, regardless of whether the call itself
   ever settles — generous relative to how fast a real resolution always
   is (single-/low-double-digit milliseconds in every run logged today),
   far shorter than the full give-up ceiling above. */
const AUDIO_SELECT_GRACE_MS = 2000;

/* A live audio-track switch's real success rate turned out to depend on how
   long the underlying video has been loading before the Vimeo.Player is
   ever CONSTRUCTED — not on retrying, not on pause() timing, not on
   anything about the select call itself, and (confirmed separately) not
   even on how long an already-constructed player merely sits idle before
   its first call. Confirmed 2026-09-10 by direct measurement on the
   worse-performing page: constructing the player immediately and calling
   selectAudioTrack() right away succeeded 0/8; constructing immediately but
   waiting 8s before the first CALL (same player object) still only
   succeeded 1/5; constructing a fresh player only AFTER an 8s wait
   succeeded 4/5. Same iframe, same elapsed time either way — only the
   construction MOMENT differed. Retrying an already-failed attempt, even
   with real multi-second delays between retries, never once rescued it
   either — so the fix waits out a warm-up floor before `new Vimeo.Player()`
   is ever called (see its call site in loadVideo()), instead of
   constructing immediately and hoping a delayed call or a retry helps.
   Matches TRACK_SWITCH_TIMEOUT_MS's own value — one consistent "how long
   Vimeo needs" figure used both as this floor and as the give-up ceiling —
   rather than a second, differently-tuned magic number. Real tradeoff, not
   free: pressing play now delays how soon the language picker becomes
   interactive by up to this same amount when starting on a non-English
   default (see the isPlaying && player fallback in handleLangSegmentClick
   for how a click during that window is handled). */
const PLAYER_WARMUP_MS = TRACK_SWITCH_TIMEOUT_MS;

function waitForPlayerWarmup(sinceTimestamp) {
  const remaining = PLAYER_WARMUP_MS - (Date.now() - sinceTimestamp);
  logLangSwitch(
    "waitForPlayerWarmup: sinceTimestamp =",
    sinceTimestamp,
    "elapsed =",
    Date.now() - sinceTimestamp,
    "ms, remaining =",
    remaining,
    "ms",
  );
  if (remaining <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) =>
    setTimeout(() => {
      logLangSwitch("waitForPlayerWarmup: wait finished, constructing player now");
      resolve();
    }, remaining),
  );
}

function withTrackSwitchTimeout(promise, label) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      logLangSwitch(
        `withTrackSwitchTimeout(${label}): TIMED OUT after`,
        Date.now() - startedAt,
        "ms (limit",
        TRACK_SWITCH_TIMEOUT_MS,
        "ms) -- resolving false",
      );
      resolve(false);
    }, TRACK_SWITCH_TIMEOUT_MS);
    promise.then(
      (ok) => {
        clearTimeout(timer);
        logLangSwitch(
          `withTrackSwitchTimeout(${label}): settled normally after`,
          Date.now() - startedAt,
          "ms, ok =",
          ok,
        );
        resolve(ok);
      },
      (err) => {
        clearTimeout(timer);
        logLangSwitch(
          `withTrackSwitchTimeout(${label}): the wrapped promise REJECTED after`,
          Date.now() - startedAt,
          "ms (unexpected -- callers should already be catching their own errors)",
          err,
        );
        resolve(false);
      },
    );
  });
}

/* selectAudioTrack()/selectDefaultAudioTrack() resolving is NOT a reliable
   signal that the audio track actually changed — confirmed 2026-09-10 by
   direct testing: it can resolve successfully ({"language":"es"}, no error)
   while getAudioTracks() shows the previous language still the one actually
   enabled. Unlike enableTextTrack(), whose own resolved value includes a
   real showing flag, the audio methods' resolved value carries no
   self-reported confirmation at all — it just echoes back the request
   regardless of outcome. Also confirmed: when it fails this way, it fails
   identically on every immediate retry within the same page load (not a
   per-call coin flip) — retrying the same call doesn't help, so the fix is
   to verify the real result instead of trusting the promise, not to retry. */
function verifyAudioTrackActive(player, langCode) {
  logLangSwitch("verifyAudioTrackActive: calling getAudioTracks() to check for langCode =", langCode);
  return player.getAudioTracks().then(
    (tracks) => {
      logLangSwitch("verifyAudioTrackActive: getAudioTracks() resolved with", tracks);
      const result = tracks.some((t) => {
        const isMatch = t.language === langCode && t.enabled;
        logLangSwitch(
          "verifyAudioTrackActive: checking track",
          { language: t.language, kind: t.kind, enabled: t.enabled },
          "-- t.language === langCode?",
          t.language === langCode,
          ", t.enabled?",
          t.enabled,
          "=> isMatch =",
          isMatch,
        );
        return isMatch;
      });
      logLangSwitch("verifyAudioTrackActive: final result for langCode =", langCode, "is", result);
      return result;
    },
    (err) => {
      logLangSwitch("verifyAudioTrackActive: getAudioTracks() REJECTED", err);
      return false;
    },
  );
}

/* selectAudioTrack(language, kind) takes an optional second `kind` argument
   ("main" | "translation" | "descriptions" | "commentary" — see Vimeo's own
   Player SDK reference) that this code was never passing. Confirmed by
   direct testing 2026-09-10: every alternate-language audio track on this
   site's videos is tagged kind "translation" (not "main"), and calling
   selectAudioTrack(langCode) with no kind measured well under 50% actual
   success; looking up the track's real kind first and passing it explicitly
   roughly doubled that. Looked up fresh each call (not hardcoded to
   "translation") so this keeps working correctly if a future video's track
   is ever tagged some other kind. Still not 100% reliable even with the
   correct kind — Vimeo only shipped selectAudioTrack() in December 2025, and
   some residual flakiness in this very new API appears to be real, not
   something fixable from the calling side (see verifyAudioTrackActive()
   above, still needed as the safety net for whatever's left). */
function selectAudioTrackForLanguage(player, langCode) {
  logLangSwitch("selectAudioTrackForLanguage: langCode =", langCode);
  if (langCode === "en") {
    logLangSwitch("selectAudioTrackForLanguage: english -- calling selectDefaultAudioTrack()");
    const promise = player.selectDefaultAudioTrack();
    promise.then(
      (result) => logLangSwitch("selectAudioTrackForLanguage: selectDefaultAudioTrack() resolved", result),
      (err) => logLangSwitch("selectAudioTrackForLanguage: selectDefaultAudioTrack() REJECTED", err),
    );
    return promise;
  }
  return player.getAudioTracks().then((tracks) => {
    logLangSwitch("selectAudioTrackForLanguage: getAudioTracks() before select:", tracks);
    const kind = tracks.find((t) => t.language === langCode)?.kind;
    logLangSwitch(
      "selectAudioTrackForLanguage: resolved kind =",
      kind,
      "for langCode =",
      langCode,
      "-- calling selectAudioTrack(",
      langCode,
      ",",
      kind,
      ")",
    );
    const promise = player.selectAudioTrack(langCode, kind);
    promise.then(
      (result) => logLangSwitch("selectAudioTrackForLanguage: selectAudioTrack() resolved", result),
      (err) => logLangSwitch("selectAudioTrackForLanguage: selectAudioTrack() REJECTED", err),
    );
    return promise;
  });
}

function switchLiveTrack(player, langCode) {
  logLangSwitch("switchLiveTrack: STARTING for langCode =", langCode, "player =", player);

  const captionsPromise = withTrackSwitchTimeout(
    player.enableTextTrack(langCode).then(
      (result) => {
        logLangSwitch("switchLiveTrack: enableTextTrack() resolved", result);
        return true;
      },
      (err) => {
        console.warn(`No ${langCode} subtitle track on this video`, err);
        logLangSwitch("switchLiveTrack: enableTextTrack() REJECTED", err);
        return false;
      },
    ),
    "captions",
  );

  // Sequential on purpose — see the "run ONE AFTER ANOTHER" note above.
  return captionsPromise.then((captionsOk) => {
    logLangSwitch(
      "switchLiveTrack: captions sub-call settled, captionsOk =",
      captionsOk,
      "-- starting audio sub-call now",
    );

    // Verifying real state (below) is deliberately NOT chained directly
    // onto selectAudioTrackForLanguage()'s own promise — that promise can
    // hang and never settle at all, even on an already-established player
    // (see AUDIO_SELECT_GRACE_MS above), and gating the real check behind
    // it meant a hang was reported as a failure even on switches that had
    // genuinely already succeeded. Whichever happens first — the select
    // call settling, or the grace period elapsing — triggers the real
    // getAudioTracks() check; only one of the two ever runs it.
    const audioPromise = withTrackSwitchTimeout(
      new Promise((resolve) => {
        let checked = false;
        const checkRealState = (reason) => {
          if (checked) return;
          checked = true;
          logLangSwitch(
            "switchLiveTrack: verifying real audio state now (",
            reason,
            ") for langCode =",
            langCode,
          );
          resolve(verifyAudioTrackActive(player, langCode));
        };

        selectAudioTrackForLanguage(player, langCode).then(
          () => checkRealState("select call settled normally"),
          (err) => {
            console.warn(`No ${langCode} audio track on this video`, err);
            logLangSwitch("switchLiveTrack: selectAudioTrackForLanguage() REJECTED", err);
            checkRealState("select call rejected");
          },
        );

        setTimeout(
          () => checkRealState("grace period elapsed, select call still pending"),
          AUDIO_SELECT_GRACE_MS,
        );
      }),
      "audio",
    );

    return audioPromise.then((audioOk) => {
      logLangSwitch(
        "switchLiveTrack: DONE for langCode =",
        langCode,
        "-> { audioOk:",
        audioOk,
        ", captionsOk:",
        captionsOk,
        "}",
      );
      return { audioOk, captionsOk };
    });
  });
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
    "audio-missing": `${name} captions are on, but the audio isn't available yet for this video.`,
    "captions-missing": `${name} audio is on, but captions aren't available yet for this video.`,
  }[kind];

  el.textContent = template
    ? applyLanguagePlaceholder(template, name)
    : fallback;
  el.classList.add("is-visible");
}

/* ── Live track-switch busy state (video-quote blocks only) ──
   Gates BOTH switchLiveTrack() call sites (loadVideo()'s automatic
   post-player-creation re-verify, and handleLangSegmentClick()'s live
   click-driven switch) behind the same picker-disabled lock — see
   trackSwitchBusy in the per-block closure below. This is what actually
   closes the race between those two call sites (one could hang while the
   other fired concurrently, which is how the original "toggle switches
   captions but not audio" bug happened): a disabled <button> can't dispatch
   a click at all, so only one switchLiveTrack() call is ever in flight per
   block. */
function setLangPickerBusy(block, isBusy) {
  getLangSegments(block).forEach((segment) => {
    segment.disabled = isBusy;
  });
}

function getVideoLoadingOverlayEl(block) {
  return block.querySelector(".video-quote-loading-overlay");
}

function setVideoLoadingOverlayVisible(block, visible) {
  const el = getVideoLoadingOverlayEl(block);
  if (el) {
    el.classList.toggle("is-visible", visible);
  }
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

/* In-flight "Switching to {language}…" status (video-quote live switch
   only) — reuses the SAME .lang-change-status element/template idiom as
   showLangChangeStatus() above rather than a separate element, since it's
   an earlier phase of that same "genuine language change" concept, not a
   different one. Cancels any pending fade-out timer instead of scheduling
   its own — this message stays up for the whole in-flight switch, however
   long that takes, not a fixed duration. showLangChangeStatus() (called on
   full success) naturally overwrites the text and restarts the fade timer
   afterward; clearLangChangeStatus() is used on the failure/partial
   branches so a stale "Switching…" message doesn't linger next to the
   track-note. */
function getTrackSwitchStatusTemplate() {
  return (
    document.querySelector(".track-switch-status-template")?.textContent ??
    null
  );
}

function showTrackSwitchStatus(block, targetLang) {
  const el = block.querySelector(".lang-change-status");
  if (!el) return;

  const name = langName(targetLang);
  const template = getTrackSwitchStatusTemplate();
  el.textContent = template
    ? applyLanguagePlaceholder(template, name)
    : `Switching to ${name}…`;
  el.classList.add("is-visible");

  clearTimeout(langChangeStatusTimeouts.get(block));
}

function clearLangChangeStatus(block) {
  const el = block.querySelector(".lang-change-status");
  if (!el) return;

  clearTimeout(langChangeStatusTimeouts.get(block));
  el.textContent = "";
  el.classList.remove("is-visible");
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
    let trackSwitchBusy = false; // true while a live switchLiveTrack() is in flight (quote blocks only)

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
        //
        // The Vimeo.Player CONSTRUCTOR's own timing is what determines live
        // track-switch reliability later — not merely how long the caller
        // waits before calling methods on an already-existing instance.
        // Confirmed 2026-09-10 by direct A/B test: an early-constructed
        // player, left to sit for 8s before its first selectAudioTrack()
        // call, still only succeeded 1/5; a player constructed fresh AFTER
        // that same 8s wait succeeded 4/5 — same underlying iframe, same
        // elapsed time, only the construction moment differed. So the
        // warm-up wait belongs HERE, before `new Vimeo.Player()` itself,
        // not wrapped around switchLiveTrack() at the call sites (an
        // earlier version of this fix did that and measured close to 0%
        // real-world improvement despite testing well in isolation).
        const videoLoadStartedAt = Date.now();
        logLangSwitch("loadVideo: quote block, videoLoadStartedAt =", videoLoadStartedAt, "currentLang =", currentLang);
        ensureVimeoSdk()
          .then((Vimeo) => {
            logLangSwitch("loadVideo: Vimeo SDK ready, entering warmup wait");
            return waitForPlayerWarmup(videoLoadStartedAt).then(() => Vimeo);
          })
          .then((Vimeo) => {
            player = new Vimeo.Player(iframe);
            logLangSwitch(
              "loadVideo: player CONSTRUCTED after",
              Date.now() - videoLoadStartedAt,
              "ms, player =",
              player,
            );

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
            logLangSwitch("loadVideo: automatic re-verify -- attemptedLang (live currentLang) =", attemptedLang);

            // English has nothing to re-verify: buildVimeoPlayerSrc() never
            // requests an explicit audiotrack override for "en" (unlike
            // es/hi), so unlike those languages there's no "did the
            // requested track actually apply" question to answer — English
            // is just whatever the video's own original audio is, which by
            // definition is always there. Calling switchLiveTrack() here
            // anyway produced a real, confusing false positive: an
            // occasional slow/timed-out selectDefaultAudioTrack() call (the
            // same unpredictable Vimeo-side latency documented above,
            // sometimes several seconds even when nothing is actually
            // wrong) got reported as "English captions are on, but dubbed
            // audio isn't available" while the visitor was actively
            // hearing normal English audio the whole time — English is
            // never a "dub" in the first place. Found 2026-09-10 by Janet
            // playing the site in its own default language. Skipping the
            // check entirely for "en" removes the false-positive path
            // without weakening the real verification es/hi still get.
            if (attemptedLang !== "en") {
              // Silent lock only (no pause/overlay/status) — this call isn't
              // user-initiated. It still needs the same busy lock as the
              // click-driven switch below, or a click landing while this is
              // in flight races it — that race is what caused the original
              // bug (see the module doc comment above TRACK_SWITCH_TIMEOUT_MS).
              // The disabled-picker CSS still dims the toggle during this
              // window, so it's not zero feedback. By the time execution
              // reaches here, `player` was already constructed AFTER the
              // warm-up wait above, so this call itself needs no further
              // delay of its own.
              trackSwitchBusy = true;
              setLangPickerBusy(block, true);
              logLangSwitch(
                "loadVideo: attemptedLang !== 'en', calling switchLiveTrack() for the automatic re-verify",
              );

              switchLiveTrack(player, attemptedLang).then(
                ({ audioOk, captionsOk }) => {
                  logLangSwitch(
                    "loadVideo: automatic re-verify settled -- audioOk =",
                    audioOk,
                    "captionsOk =",
                    captionsOk,
                  );
                  if (!audioOk && !captionsOk) {
                    logLangSwitch("loadVideo: TOTAL FAILURE -- rolling back to 'en' and showing track-note");
                    setEpisodeLanguage("en");
                    // Also required here, not just at the click-driven call
                    // site: the "player not yet constructed" fallback branch
                    // in handleLangSegmentClick() may have already shown an
                    // optimistic "Switched to X." with its own independent
                    // fade timer before this correction arrives — without
                    // clearing it, that stale success text and this
                    // track-note could both be visible at once.
                    clearLangChangeStatus(block);
                    showTrackNote(block, attemptedLang, {
                      audioOk,
                      captionsOk,
                      totalFailure: true,
                    });
                  } else if (!audioOk || !captionsOk) {
                    logLangSwitch("loadVideo: PARTIAL FAILURE -- showing track-note, staying on", attemptedLang);
                    clearLangChangeStatus(block);
                    showTrackNote(block, attemptedLang, {
                      audioOk,
                      captionsOk,
                      totalFailure: false,
                    });
                  } else {
                    logLangSwitch("loadVideo: automatic re-verify fully succeeded, no note needed");
                  }

                  trackSwitchBusy = false;
                  setLangPickerBusy(block, false);
                },
              );
            } else {
              logLangSwitch("loadVideo: attemptedLang === 'en', skipping the automatic re-verify entirely");
            }
          })
          .catch((err) => {
            console.warn("Could not load the Vimeo Player SDK", err);
            logLangSwitch("loadVideo: ensureVimeoSdk() REJECTED", err);
          });
      }
    }

    function handleLangSegmentClick(lang, triggerEl) {
      const target = normalizeLangCode(lang);
      logLangSwitch(
        "handleLangSegmentClick: clicked target =",
        target,
        "isQuoteBlock =",
        isQuoteBlock,
        "isPlaying =",
        isPlaying,
        "player =",
        player,
        "trackSwitchBusy =",
        trackSwitchBusy,
      );

      if (isQuoteBlock) {
        const previousLang = currentLang;
        setEpisodeLanguage(target); // optimistic: active-class only, no reload
        clearTrackNote(block); // clear any stale note on every new attempt

        if (isPlaying && player) {
          if (trackSwitchBusy) {
            // Defensive only — the picker's real `disabled` attribute
            // should already prevent a click from reaching here while a
            // switch (this one or the automatic re-verify) is in flight.
            logLangSwitch("handleLangSegmentClick: trackSwitchBusy already true, ignoring this click (defensive)");
            return;
          }

          logLangSwitch("handleLangSegmentClick: player exists and playing -- doing a LIVE switch to", target);
          trackSwitchBusy = true;
          setLangPickerBusy(block, true);
          setVideoLoadingOverlayVisible(block, true);
          showTrackSwitchStatus(block, target);
          player.pause().catch((err) => logLangSwitch("handleLangSegmentClick: player.pause() rejected", err));

          switchLiveTrack(player, target).then(({ audioOk, captionsOk }) => {
            logLangSwitch(
              "handleLangSegmentClick: live switch to",
              target,
              "settled -- audioOk =",
              audioOk,
              "captionsOk =",
              captionsOk,
            );
            if (!audioOk && !captionsOk) {
              // Total failure: roll back the UI to what's actually still playing.
              logLangSwitch("handleLangSegmentClick: TOTAL FAILURE -- rolling back to", previousLang);
              setEpisodeLanguage(previousLang);
              clearLangChangeStatus(block);
              showTrackNote(block, target, {
                audioOk,
                captionsOk,
                totalFailure: true,
              });
            } else if (!audioOk || !captionsOk) {
              // Partial success: a real switch happened, so stay on the new
              // language, but let the visitor know what's missing.
              logLangSwitch("handleLangSegmentClick: PARTIAL FAILURE -- staying on", target);
              clearLangChangeStatus(block);
              showTrackNote(block, target, {
                audioOk,
                captionsOk,
                totalFailure: false,
              });
            } else {
              // Full success: both tracks switched cleanly.
              logLangSwitch("handleLangSegmentClick: FULL SUCCESS for", target);
              showLangChangeStatus(block, target);
            }

            // Resume regardless of outcome — a visitor shouldn't be left
            // staring at a paused video just because their picked language
            // wasn't fully available; it resumes in whichever language
            // actually ended up active (the rollback above, if any, already
            // ran by this point).
            player.play().catch((err) => logLangSwitch("handleLangSegmentClick: player.play() rejected", err));
            trackSwitchBusy = false;
            setLangPickerBusy(block, false);
            setVideoLoadingOverlayVisible(block, false);
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
          logLangSwitch(
            "handleLangSegmentClick: FALLBACK branch (not playing yet, or player not constructed yet) -- showing optimistic status for",
            target,
            "and deferring to loadVideo()'s automatic re-verify",
          );
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
