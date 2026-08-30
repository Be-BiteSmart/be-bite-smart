import "./style.css";
import "./citation-tooltip.js"; // separate, self-contained script — see its own header comment; imported here so it loads under the same enqueue/webpack entry as everything else in this file

// Front-end controller for:
//  1. The shared "Show video" / "Show text" checkbox bar
//     (bitesmart_render_guide_format_controls(), guide-chapter-display.php)
//     — persisted per-browser via localStorage, no accounts on this site
//     (see [[be-bitesmart-guide-cpt-plan]] in memory). Turns a format off
//     for EVERY chapter at once.
//  2. Each chapter row's own Video/Text badge buttons — turn a format
//     off/on for just THAT chapter, layered under (never overriding) the
//     global checkboxes above — see applyFormatState() for how the two
//     combine. (The Table of Contents, guide-single.php, deliberately
//     doesn't carry its own copy of these — plain links only, see
//     bitesmart_render_guide_toc_item()'s own comment for why.)
//  3. Each chapter row's video language picker.
//  Both (2) and (3) are event-delegated (document-level listeners, not
//  bound to specific elements up front) — see the "why" in
//  guide-chapter-display.php's header comment: a chapter row can enter the
//  DOM well after DOMContentLoaded, e.g. when the pooled search page's
//  Fuse.js swaps in newly-matched cards, so nothing here can bind to
//  specific elements the way video-toggle.js does.
//
// Deliberately its own small script rather than folding into
// toggle-system.js/video-toggle.js — neither of those own anything
// resembling "a page-wide preference that hides/shows content across many
// independent cards," and video-toggle.js's whole model (bind once at
// DOMContentLoaded, live in-player language switching via the Vimeo Player
// SDK) is the wrong shape for content that can appear after page load.

const STORAGE_KEY = "bitesmartGuideFormatPrefs";

function readStoredPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      video: parsed.video !== false,
      text: parsed.text !== false,
    };
  } catch {
    return null;
  }
}

function writeStoredPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (private-browsing lockdown, etc.) — the page
    // still works, it just won't remember the preference next visit.
  }
}

function currentCheckboxState() {
  const videoBox = document.querySelector('.guide-format-checkbox[data-format="video"]');
  const textBox = document.querySelector('.guide-format-checkbox[data-format="text"]');
  return {
    video: videoBox ? videoBox.checked : true,
    text: textBox ? textBox.checked : true,
  };
}

// Whether a given chapter row's badge for `format` is currently toggled ON
// — badges default to "on" (aria-pressed="true") whenever the chapter
// actually has that format; a disabled badge (chapter has NO video/text at
// all — see guide-chapter-display.php) has nothing to toggle, so it always
// reads as "on" here, meaning visibility for that chapter comes down to the
// GLOBAL checkbox alone (which is what shows/hides the "no video/text yet"
// note).
function chapterBadgeIsOn(row, format) {
  const badge = row.querySelector(`.guide-chapter-badge[data-format="${format}"]`);
  if (!badge || badge.disabled) return true;
  return badge.getAttribute("aria-pressed") !== "false";
}

// Shows/hides every currently-present chapter's video/text sections (and
// missing-format notes — they share the same .guide-chapter-format
// [data-format] markup, mutually exclusive per chapter, so one query covers
// both). TWO independent layers combine here, both true by default: the
// global "Show video"/"Show text" checkboxes (off = hidden for EVERY
// chapter, full stop) AND each chapter's own badge toggle (off = hidden for
// just that one chapter) — a format only actually shows when BOTH are on.
// Exposed on window so a future integration (the pooled search page
// re-rendering its visible card set on every keystroke) can re-apply the
// current preference to freshly-inserted rows without duplicating this
// logic.
function applyFormatState() {
  const { video, text } = currentCheckboxState();

  document.querySelectorAll(".guide-chapter-row").forEach((row) => {
    const videoVisible = video && chapterBadgeIsOn(row, "video");
    const textVisible = text && chapterBadgeIsOn(row, "text");

    row.querySelectorAll('.guide-chapter-format[data-format="video"]').forEach((el) => {
      el.hidden = !videoVisible;
    });
    row.querySelectorAll('.guide-chapter-format[data-format="text"]').forEach((el) => {
      el.hidden = !textVisible;
    });
  });

  document.querySelectorAll(".guide-format-warning").forEach((el) => {
    el.hidden = video || text;
  });
}
window.bitesmartApplyGuideFormatState = applyFormatState;

// Per-chapter badge click — toggles that ONE chapter's format on/off,
// independent of every other chapter and of the global checkboxes. Has to
// call preventDefault(): a badge sits inside the chapter's <summary>, and
// the browser's native behavior for ANY click landing inside a <summary>
// (buttons included) is to toggle the enclosing <details> open/closed —
// without preventDefault() here, clicking a badge would just collapse or
// expand the whole chapter instead of toggling the badge.
function handleBadgeClick(e) {
  const badge = e.target.closest(".guide-chapter-badge");
  if (!badge || badge.disabled) return;

  e.preventDefault();
  e.stopPropagation();

  const turningOff = badge.getAttribute("aria-pressed") !== "false";
  badge.setAttribute("aria-pressed", turningOff ? "false" : "true");
  badge.classList.toggle("is-active", !turningOff);
  badge.classList.toggle("is-off", turningOff);

  applyFormatState();
}

function restoreCheckboxes() {
  const stored = readStoredPrefs();
  if (!stored) return; // both boxes are already server-rendered checked, matches the no-JS default

  document.querySelectorAll(".guide-format-checkbox").forEach((el) => {
    el.checked = stored[el.dataset.format] !== false;
  });
}

function handleCheckboxChange(e) {
  if (!e.target.classList.contains("guide-format-checkbox")) return;

  // Multiple controls bars on one page shouldn't normally happen, but keep
  // every bar's checkboxes in sync with each other just in case.
  const format = e.target.dataset.format;
  document.querySelectorAll(`.guide-format-checkbox[data-format="${format}"]`).forEach((el) => {
    el.checked = e.target.checked;
  });

  writeStoredPrefs(currentCheckboxState());
  applyFormatState();
}

function handleLangSegmentClick(e) {
  const segment = e.target.closest(".lang-segment");
  if (!segment) return;

  const videoWrap = segment.closest(".guide-chapter-video");
  const frame = videoWrap?.querySelector(".guide-chapter-video-frame[data-videos]");
  if (!frame) return; // click was on some other page's .lang-segment, e.g. Episode's

  let videos = {};
  try {
    videos = JSON.parse(frame.dataset.videos || "{}");
  } catch {
    return;
  }

  const vimeoId = videos[segment.dataset.lang];
  const iframe = frame.querySelector("iframe");
  if (!vimeoId || !iframe) return;

  iframe.src = `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`;

  const picker = segment.closest(".episode-lang-picker");
  if (!picker) return;
  const segments = Array.from(picker.querySelectorAll(".lang-segment"));
  segments.forEach((el) => el.classList.toggle("active", el === segment));
  picker.style.setProperty("--lang-count", String(segments.length));
  picker.style.setProperty("--lang-index", String(Math.max(0, segments.indexOf(segment))));
}

// Landing on e.g. /learning/guide/#some-guide-chapter-3 (a hash link to one
// chapter within the Guide's own accordion page — see
// bitesmart_guide_chapter_anchor_id() in guide-chapter-display.php) scrolls
// the browser to that <details> element, but a native <details> doesn't
// auto-open just because
// IT is the fragment target (only a collapsed ancestor of the target does
// that) — so without this, a visitor following such a link would see the
// right chapter scrolled into view but still collapsed, one extra click
// away from the content they actually clicked through for.
function openHashTargetChapter() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;

  const el = document.getElementById(id);
  if (el && el.tagName === "DETAILS") {
    el.open = true;
  }
}

function init() {
  restoreCheckboxes();
  applyFormatState();
  openHashTargetChapter();

  document.addEventListener("change", handleCheckboxChange);
  document.addEventListener("click", handleLangSegmentClick);
  document.addEventListener("click", handleBadgeClick);
  window.addEventListener("hashchange", openHashTargetChapter);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
