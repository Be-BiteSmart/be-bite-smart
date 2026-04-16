// ── SVG icon constants ─────────────────────────────────────
// innerHTML is used instead of textContent so SVGs are preserved
// Passed from PHP via wp_localize_script
const PLAY_ICON = qrExperience.playIcon;
const PAUSE_ICON = qrExperience.pauseIcon;

// ── State ──────────────────────────────────────────────────
const state = {
  mode: null,
  step: 1,
  paused: false,
};

const TOTAL_STEPS = qrExperience.totalSteps;

const STEP_LABELS = {
  1: "Step 1 of 4: Opening narration",
  2: "Step 2 of 4: Video",
  3: "Step 3 of 4: Closing narration",
  4: "Step 4 of 4: Complete",
};

// ── Element refs ───────────────────────────────────────────
const announcer = document.getElementById("qr-announcer");
const stepIndicator = document.getElementById("qr-step-indicator");
const pausedMsg = document.getElementById("qr-paused-msg");
const replayBtn = document.getElementById("btn-replay");
const upNext = document.getElementById("qr-up-next");

const modeIntro = document.getElementById("qr-mode-intro");
const modeReading = document.getElementById("qr-mode-reading");
const modeNarrated = document.getElementById("qr-mode-narrated");

const audioOpening = document.getElementById("audio-narrated-opening");
const audioClosing = document.getElementById("audio-narrated-closing");
const pauseBtnOpen = document.getElementById("btn-pause-opening");
const pauseBtnClose = document.getElementById("btn-pause-closing");

let vimeoNarrated = null; // assigned later in runStep2

// ── Helpers ────────────────────────────────────────────────
function announce(text) {
  if (!announcer) return;
  announcer.textContent = "";
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      announcer.textContent = text;
    });
  });
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

// ── Lazy Vimeo loader ──────────────────────────────────────
let vimeoReady = false;
let vimeoReadyCallbacks = [];

function loadVimeoSDK(cb) {
  if (vimeoReady) return cb();
  vimeoReadyCallbacks.push(cb);
  if (document.querySelector('script[src*="vimeo.com/api/player"]')) return;

  const s = document.createElement("script");
  s.src = "https://player.vimeo.com/api/player.js";
  s.onload = function () {
    vimeoReady = true;
    vimeoReadyCallbacks.forEach((fn) => fn());
    vimeoReadyCallbacks = [];
  };
  document.head.appendChild(s);
}

// ── Wire time display to an audio element ──────────────────
function wireAudioTime(audioId) {
  const audio = document.getElementById(audioId);
  const displays = document.querySelectorAll(
    '.qr-audio-time[data-audio="' + audioId + '"]',
  );
  if (!audio || !displays.length) return;

  audio.addEventListener("loadedmetadata", function () {
    const dur = formatTime(audio.duration);
    displays.forEach(function (el) {
      el.textContent = "0:00 / " + dur;
    });
  });

  audio.addEventListener("timeupdate", function () {
    const cur = formatTime(audio.currentTime);
    const dur = isNaN(audio.duration) ? "--:--" : formatTime(audio.duration);
    displays.forEach(function (el) {
      el.textContent = cur + " / " + dur;
    });
  });

  audio.addEventListener("ended", function () {
    const dur = isNaN(audio.duration) ? "--:--" : formatTime(audio.duration);
    displays.forEach(function (el) {
      el.textContent = "0:00 / " + dur;
    });
  });
}

// Wire time displays for all four audio elements
wireAudioTime("audio-reading-opening");
wireAudioTime("audio-reading-closing");
wireAudioTime("audio-narrated-opening");
wireAudioTime("audio-narrated-closing");

// ── Show mode panel ────────────────────────────────────────
function showMode(modeEl) {
  [modeIntro, modeReading, modeNarrated].forEach(function (el) {
    if (el) el.classList.remove("active");
  });
  if (modeEl) modeEl.classList.add("active");
}

// ── Activate narrated step ─────────────────────────────────
function activateStep(n) {
  state.step = n;

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById("qr-step-" + i);
    if (!el) continue;
    if (i === n) {
      el.removeAttribute("aria-hidden");
      el.removeAttribute("inert");
      el.setAttribute("aria-current", "step");
      el.focus({ preventScroll: true });
    } else {
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("inert", "");
      el.removeAttribute("aria-current");
    }
  }

  if (stepIndicator) stepIndicator.textContent = n + " of " + TOTAL_STEPS;
  announce(STEP_LABELS[n] || "Step " + n + " of " + TOTAL_STEPS);
  updateReplayBtn(n);
}

function updateReplayBtn(n) {
  if (!replayBtn) return;
  if (n <= 1) {
    replayBtn.disabled = true;
    replayBtn.setAttribute(
      "aria-label",
      "Replay previous section (not available yet)",
    );
  } else {
    replayBtn.disabled = false;
    replayBtn.setAttribute("aria-label", "Replay previous section");
  }
}

// ── Stop all media ─────────────────────────────────────────
function stopAllAudio() {
  [audioOpening, audioClosing].forEach(function (a) {
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  });
  if (vimeoNarrated) vimeoNarrated.pause().catch(function () {});
}

// ── Wire narrated pause/resume button ─────────────────────
// Uses innerHTML to preserve SVG icons
function wirePauseBtn(btn, audio) {
  if (!btn || !audio) return btn;
  if (btn._wired) return btn;
  btn._wired = true;

  btn.addEventListener("click", function () {
    if (audio.paused) {
      audio.play();
      state.paused = false;
      btn.innerHTML = PAUSE_ICON + "Pause";
      btn.setAttribute(
        "aria-label",
        btn.getAttribute("aria-label").replace("Resume", "Pause"),
      );
      if (pausedMsg) pausedMsg.textContent = "";
    } else {
      audio.pause();
      state.paused = true;
      btn.innerHTML = PLAY_ICON + "Resume";
      btn.setAttribute(
        "aria-label",
        btn.getAttribute("aria-label").replace("Pause", "Resume"),
      );
      if (pausedMsg)
        pausedMsg.textContent =
          "You've paused the experience. Tap resume to continue.";
      announce("You've paused the experience.");
    }
  });

  return btn;
}

// ── Play audio with autoplay fallback ─────────────────────
function playAudio(audio, pauseBtn, onEnded) {
  if (!audio) {
    if (onEnded) onEnded();
    return;
  }

  if (audio._endedHandler)
    audio.removeEventListener("ended", audio._endedHandler);
  if (onEnded) {
    audio._endedHandler = function () {
      onEnded();
    };
    audio.addEventListener("ended", audio._endedHandler, { once: true });
  }

  audio.currentTime = 0;
  const promise = audio.play();
  if (promise !== undefined) {
    promise.catch(function () {
      if (pauseBtn) {
        pauseBtn.innerHTML = PLAY_ICON + "Tap to begin";
        pauseBtn.setAttribute("aria-label", "Tap to begin narration");
        pauseBtn.onclick = function () {
          audio.play();
          pauseBtn.innerHTML = PAUSE_ICON + "Pause";
          pauseBtn.setAttribute(
            "aria-label",
            pauseBtn
              .getAttribute("aria-label")
              .replace("Tap to begin narration", "Pause"),
          );
          pauseBtn.onclick = null;
        };
      }
    });
  }
}

// ── Transcript toggles (both modes) ───────────────────────
document.querySelectorAll(".qr-transcript-toggle").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    const isOpen = btn.getAttribute("aria-expanded") === "true";
    panel.hidden = isOpen;
    btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
    btn.textContent = isOpen ? "Show transcript" : "Hide transcript";
  });
});

// ── Reading mode: manual play/pause buttons ────────────────
// These use data-audio, not IDs — no conflict with narrated buttons
document
  .querySelectorAll(".qr-audio-play-btn[data-audio]")
  .forEach(function (btn) {
    const audio = document.getElementById(btn.getAttribute("data-audio"));
    if (!audio) return;

    btn.addEventListener("click", function () {
      if (audio.paused) {
        audio.play();
        btn.innerHTML = PAUSE_ICON + "Pause";
        btn.setAttribute(
          "aria-label",
          btn.getAttribute("aria-label").replace("Play", "Pause"),
        );
      } else {
        audio.pause();
        btn.innerHTML = PLAY_ICON + "Play";
        btn.setAttribute(
          "aria-label",
          btn.getAttribute("aria-label").replace("Pause", "Play"),
        );
      }
    });

    audio.addEventListener("ended", function () {
      btn.innerHTML = PLAY_ICON + "Play";
      btn.setAttribute(
        "aria-label",
        btn.getAttribute("aria-label").replace("Pause", "Play"),
      );
    });
  });

// ── Mode selection ─────────────────────────────────────────
const btnNarrated = document.getElementById("btn-start-narrated");
const btnReading = document.getElementById("btn-start-reading");

if (btnNarrated) {
  btnNarrated.addEventListener("click", function () {
    state.mode = "narrated";
    showMode(modeNarrated);
    startNarratedMode();
  });
}

if (btnReading) {
  btnReading.addEventListener("click", function () {
    state.mode = "reading";
    showMode(modeReading);
    announce(
      "Reading mode. All content is shown. Audio plays only when you choose.",
    );
  });
}

// ── Switch mode buttons ────────────────────────────────────
const btnToNarrated = document.getElementById("btn-switch-to-narrated");
const btnToReading = document.getElementById("btn-switch-to-reading");

if (btnToNarrated) {
  btnToNarrated.addEventListener("click", function () {
    stopAllAudio();
    state.mode = "narrated";
    showMode(modeNarrated);
    startNarratedMode();
  });
}

if (btnToReading) {
  btnToReading.addEventListener("click", function () {
    stopAllAudio();
    state.mode = "reading";
    showMode(modeReading);
    if (pausedMsg) pausedMsg.textContent = "";
    announce("Switched to reading mode.");
  });
}

// ── Replay ─────────────────────────────────────────────────
if (replayBtn) {
  replayBtn.addEventListener("click", function () {
    if (state.step <= 1) return;
    stopAllAudio();
    if (pausedMsg) pausedMsg.textContent = "";
    state.paused = false;
    runStep(state.step - 1);
  });
}

// ── Narrated mode ──────────────────────────────────────────
function startNarratedMode() {
  state.step = 1;
  state.paused = false;
  if (pausedMsg) pausedMsg.textContent = "";
  if (upNext) {
    upNext.classList.remove("visible");
    upNext.setAttribute("aria-hidden", "true");
  }
  runStep(1);
}

function runStep(n) {
  activateStep(n);
  if (n === 1) {
    runStep1();
  } else if (n === 2) {
    runStep2();
  } else if (n === 3) {
    runStep3();
  } else if (n === 4) {
    runStep4();
  }
}

function runStep1() {
  if (upNext) {
    upNext.classList.remove("visible");
    upNext.setAttribute("aria-hidden", "true");
  }
  wirePauseBtn(pauseBtnOpen, audioOpening);
  playAudio(audioOpening, pauseBtnOpen, function () {
    if (state.paused || state.step !== 1) return;
    if (upNext) {
      upNext.classList.add("visible");
      upNext.removeAttribute("aria-hidden");
      announce("Up next: a short video");
    }
    setTimeout(function () {
      if (state.step !== 1) return;
      if (upNext) {
        upNext.classList.remove("visible");
        upNext.setAttribute("aria-hidden", "true");
      }
      runStep(2);
    }, 2500);
  });
}

function runStep2() {
  const iframe = document.getElementById("vimeo-narrated");
  if (!iframe) {
    runStep(3);
    return;
  }

  loadVimeoSDK(function () {
    if (!vimeoNarrated) vimeoNarrated = new Vimeo.Player(iframe);
    vimeoNarrated.play().catch(function () {});
    vimeoNarrated.on("ended", function onVideoEnded() {
      vimeoNarrated.off("ended", onVideoEnded);
      if (state.step !== 2) return;
      runStep(3);
    });
  });
}

function runStep3() {
  wirePauseBtn(pauseBtnClose, audioClosing);
  playAudio(audioClosing, pauseBtnClose, function () {
    if (state.paused || state.step !== 3) return;
    runStep(4);
  });
}

function runStep4() {
  setTimeout(function () {
    const btn = document.getElementById("qr-button-target");
    if (btn) btn.focus({ preventScroll: true });
  }, 100);
}
