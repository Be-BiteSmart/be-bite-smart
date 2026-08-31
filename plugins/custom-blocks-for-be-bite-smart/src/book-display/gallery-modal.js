// Accessible "View Larger Image" lightbox for a book cover/preview carousel
// — see gallery.js for the trigger wiring (the enlarge button + clicking the
// image itself) and book-display.php's bitesmart_book_cover_gallery() for
// the markup/data this reads (each slide's "large" URL specifically, a
// bigger rendition than the small inline cover uses — see that function's
// own docblock for why).
//
// One modal element, shared by every .book-gallery on a page (a page can
// show several book cards at once, e.g. the Books List page) — built lazily
// on first open. Same singleton accessible-dialog shape as
// video-lang-restart-modal.js (focus-trapped panel, dismissible backdrop,
// focus restored to whatever triggered it on close), adapted for browsing
// photos instead of a confirm/cancel choice: a single Close control instead
// of two action buttons, and Prev/Next photo navigation in their place.

let modalEl = null;
let panelEl = null;
let titleEl = null;
let closeLabelEl = null;
let imageEl = null;
let counterEl = null;
let prevBtn = null;
let nextBtn = null;
let closeBtn = null;

let previousFocus = null;
let bodyOverflow = "";
let activeGallery = null; // the .book-gallery element the open modal belongs to
let navigate = null; // (direction: -1 | 1) => void, supplied by the opener

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
  modalEl.className = "book-gallery-modal";
  modalEl.hidden = true;

  const backdrop = document.createElement("div");
  backdrop.className = "book-gallery-modal__backdrop";
  backdrop.setAttribute("data-dismiss", "true");

  panelEl = document.createElement("div");
  panelEl.className = "book-gallery-modal__panel";
  panelEl.setAttribute("role", "dialog");
  panelEl.setAttribute("aria-modal", "true");
  panelEl.setAttribute("tabindex", "-1");

  titleEl = document.createElement("h2");
  titleEl.className = "book-gallery-modal__title";
  titleEl.id = "book-gallery-modal-title";
  panelEl.setAttribute("aria-labelledby", titleEl.id);

  closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "book-gallery-modal__close";
  const closeIcon = document.createElement("span");
  closeIcon.setAttribute("aria-hidden", "true");
  closeIcon.textContent = "×"; // ×, purely decorative — the visible label below carries the accessible name
  closeLabelEl = document.createElement("span");
  closeLabelEl.className = "book-gallery-modal__close-label";
  closeBtn.append(closeIcon, closeLabelEl);

  const figure = document.createElement("div");
  figure.className = "book-gallery-modal__figure";

  imageEl = document.createElement("img");
  imageEl.className = "book-gallery-modal__image";

  prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "book-gallery-arrow book-gallery-modal__arrow book-gallery-modal__prev";
  prevBtn.innerHTML = "&#8249;"; // ‹

  nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "book-gallery-arrow book-gallery-modal__arrow book-gallery-modal__next";
  nextBtn.innerHTML = "&#8250;"; // ›

  counterEl = document.createElement("span");
  counterEl.className = "book-gallery-modal__counter";
  // aria-live so a screen reader announces the new position after Prev/Next,
  // same idiom as the small inline carousel's own counter (gallery.js).
  counterEl.setAttribute("aria-live", "polite");

  figure.append(imageEl, prevBtn, nextBtn);
  panelEl.append(closeBtn, titleEl, figure, counterEl);
  modalEl.append(backdrop, panelEl);
  document.body.appendChild(modalEl);

  modalEl.addEventListener("click", (event) => {
    if (event.target?.closest("[data-dismiss]")) {
      closeGalleryModal();
    }
  });

  closeBtn.addEventListener("click", () => closeGalleryModal());
  prevBtn.addEventListener("click", () => navigate?.(-1));
  nextBtn.addEventListener("click", () => navigate?.(1));

  panelEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeGalleryModal();
      return;
    }

    // Left/Right browse photos too — a common lightbox convention, and a
    // convenience once a keyboard user is already inside the dialog; the
    // Prev/Next buttons remain the discoverable, primary way to navigate.
    if (event.key === "ArrowLeft") {
      navigate?.(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      navigate?.(1);
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

function renderModalSlide(slides, index) {
  const slide = slides[index];
  imageEl.src = slide.large || slide.url;
  imageEl.alt = slide.alt || "";

  const multi = slides.length > 1;
  prevBtn.hidden = !multi;
  nextBtn.hidden = !multi;
  counterEl.hidden = !multi;
  if (multi) {
    counterEl.textContent = `${index + 1} / ${slides.length}`;
  }
}

export function closeGalleryModal() {
  if (!modalEl || modalEl.hidden) {
    return;
  }

  modalEl.hidden = true;
  document.body.style.overflow = bodyOverflow;
  activeGallery = null;
  navigate = null;

  if (previousFocus && typeof previousFocus.focus === "function") {
    previousFocus.focus();
  }
  previousFocus = null;
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.gallery The .book-gallery this modal belongs to.
 * @param {Array<{url: string, large?: string, alt: string}>} options.slides
 * @param {number} options.index Slide to open on.
 * @param {HTMLElement} [options.triggerEl] Control to restore focus to on close.
 * @param {string} options.bookTitle
 * @param {(direction: -1 | 1) => void} options.onNavigate Called on Prev/Next/arrow keys.
 * @param {{close: string, modalLabel: string}} options.strings
 */
export function openGalleryModal({ gallery, slides, index, triggerEl, bookTitle, onNavigate, strings }) {
  ensureModal();

  activeGallery = gallery;
  navigate = onNavigate;
  previousFocus = triggerEl ?? document.activeElement;
  bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  closeLabelEl.textContent = strings.close;
  titleEl.textContent = strings.modalLabel.replace("{title}", bookTitle);
  renderModalSlide(slides, index);

  modalEl.hidden = false;
  closeBtn.focus();
}

/**
 * Called from every showSlide() in gallery.js — a no-op unless the modal is
 * currently open for this exact gallery, so the small inline carousel and
 * the modal always agree on which slide is showing without either needing
 * to track the other's state directly.
 */
export function updateGalleryModal(gallery, slides, index) {
  if (!modalEl || modalEl.hidden || activeGallery !== gallery) {
    return;
  }
  renderModalSlide(slides, index);
}
