/**
 * Accessible confirm dialog when changing episode language during playback.
 *
 * The dialog now always shows in the page's own site language (translated
 * normally by TranslatePress), not whichever language happened to be
 * playing — that's what makes it translatable via TranslatePress at all:
 * TranslatePress translates a string per the visitor's chosen site
 * language, it has no way to show a fixed, language-locked variant
 * independent of that. Wording lives in a hidden, TranslatePress-
 * translatable block printed once in the page footer (see
 * bitesmart_render_lang_restart_dialog_templates() in includes/site-lang.php)
 * — there's no more admin-editable dictionary/settings panel for this.
 */

import "./video-lang-restart-modal.css";
import { applyLanguagePlaceholder, langName, normalizeLangCode } from "./shared/languages";

const FALLBACK_COPY = {
  title: "Change language?",
  message: "The video will restart in {language}.",
  confirm: "Switch to {language}",
  cancel: "Cancel",
};

function getTemplateText(className) {
  return (
    document.querySelector(`.${className}`)?.textContent || null
  );
}

function buildDialogCopy(targetLang) {
  const targetName = langName(normalizeLangCode(targetLang));

  const title = getTemplateText("lang-restart-dialog-title") ?? FALLBACK_COPY.title;
  const messageTemplate =
    getTemplateText("lang-restart-dialog-message") ?? FALLBACK_COPY.message;
  const confirmTemplate =
    getTemplateText("lang-restart-dialog-confirm") ?? FALLBACK_COPY.confirm;
  const cancel = getTemplateText("lang-restart-dialog-cancel") ?? FALLBACK_COPY.cancel;

  return {
    title,
    message: applyLanguagePlaceholder(messageTemplate, targetName),
    confirm: applyLanguagePlaceholder(confirmTemplate, targetName),
    cancel,
  };
}

let modalEl = null;
let panelEl = null;
let titleEl = null;
let messageEl = null;
let cancelBtn = null;
let confirmBtn = null;
let previousFocus = null;
let finishPromise = null;
let bodyOverflow = "";

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function ensureModal() {
  if (modalEl) {
    return;
  }

  modalEl = document.createElement("div");
  modalEl.className = "video-lang-restart-modal";
  modalEl.hidden = true;

  const backdrop = document.createElement("div");
  backdrop.className = "video-lang-restart-modal__backdrop";
  backdrop.setAttribute("data-dismiss", "true");

  panelEl = document.createElement("div");
  panelEl.className = "video-lang-restart-modal__panel";
  panelEl.setAttribute("role", "dialog");
  panelEl.setAttribute("aria-modal", "true");
  panelEl.setAttribute("tabindex", "-1");

  titleEl = document.createElement("h2");
  titleEl.className = "video-lang-restart-modal__title";
  titleEl.id = "video-lang-restart-modal-title";

  messageEl = document.createElement("p");
  messageEl.className = "video-lang-restart-modal__message";
  messageEl.id = "video-lang-restart-modal-desc";

  panelEl.setAttribute("aria-labelledby", titleEl.id);
  panelEl.setAttribute("aria-describedby", messageEl.id);

  const actions = document.createElement("div");
  actions.className = "video-lang-restart-modal__actions";

  cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className =
    "video-lang-restart-modal__btn video-lang-restart-modal__btn--cancel";
  cancelBtn.setAttribute("data-action", "cancel");

  confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className =
    "video-lang-restart-modal__btn video-lang-restart-modal__btn--confirm";
  confirmBtn.setAttribute("data-action", "confirm");

  actions.append(cancelBtn, confirmBtn);
  panelEl.append(titleEl, messageEl, actions);
  modalEl.append(backdrop, panelEl);
  document.body.appendChild(modalEl);

  modalEl.addEventListener("click", (event) => {
    if (event.target?.closest("[data-dismiss]")) {
      close(false);
    }
  });

  cancelBtn.addEventListener("click", () => close(false));
  confirmBtn.addEventListener("click", () => close(true));

  panelEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(false);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements(panelEl);
    if (!focusable.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function close(confirmed) {
  if (!modalEl || !finishPromise) {
    return;
  }

  modalEl.hidden = true;
  document.body.style.overflow = bodyOverflow;

  const resolve = finishPromise;
  finishPromise = null;
  resolve(confirmed);

  if (previousFocus && typeof previousFocus.focus === "function") {
    previousFocus.focus();
  }
  previousFocus = null;
}

/**
 * @param {string} targetLang Language code to switch to if confirmed.
 * @param {HTMLElement} [triggerEl] Control to restore focus to on close.
 * @returns {Promise<boolean>}
 */
export function confirmLanguageRestart(targetLang, triggerEl) {
  ensureModal();

  if (finishPromise) {
    return Promise.resolve(false);
  }

  const copy = buildDialogCopy(targetLang);
  titleEl.textContent = copy.title;
  messageEl.textContent = copy.message;
  cancelBtn.textContent = copy.cancel;
  confirmBtn.textContent = copy.confirm;

  previousFocus = triggerEl ?? document.activeElement;
  bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  modalEl.hidden = false;
  confirmBtn.focus();

  return new Promise((resolve) => {
    finishPromise = resolve;
  });
}
