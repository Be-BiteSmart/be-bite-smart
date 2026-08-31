// Front-end behavior for custom/book's cover — see bitesmart_book_cover_gallery()
// in book-display.php for the server side. Deliberately NOT a fetch()/REST
// call, and deliberately NOT rendering every slide as a real <img> up front:
// only the cover (slide 0) is ever downloaded automatically on page load.
// Every other slide's url/large/alt sits inert in a
// <script type="application/json"> blob until a visitor actually clicks
// Next or opens "View Larger Image" — a real lazy-load (zero bytes for a
// slide nobody views), kinder to a worldwide/bandwidth-constrained audience
// than the native `loading="lazy"` attribute alone, which doesn't reliably
// defer images that start out hidden.
//
// Two affordances build on that same slide data, both wired up here:
// - Previous/Next arrows + a counter for a book with 2+ slides (unchanged
//   from the original carousel).
// - A "View Larger Image" button — ALWAYS present, even for a book with
//   just a plain cover and no preview photos — plus the cover image itself
//   is clickable as a bonus shortcut to the same modal (gallery-modal.js).
//   Added 2026-08-30: covers render small on the page, and a parent needs
//   an accessible, unmistakable way to see a bigger version. The button is
//   the reliable, keyboard/screen-reader-accessible path; the clickable
//   image is a free extra for anyone who tries it instinctively — not the
//   only way in, so nothing here relies on an <img> being independently
//   focusable/operable.
//
// Page-wide selector (not block-instance-scoped), same convention as
// view.js/browse.js — a page can show several book cards at once (e.g. the
// Books List page, custom/books-list), each with its own independent
// gallery.

import { openGalleryModal, updateGalleryModal } from "./gallery-modal";

function initBookGallery(gallery) {
  const image = gallery.querySelector(".book-gallery-image");
  const controls = gallery.querySelector(".book-gallery-controls");
  const dataEl = gallery.querySelector(".book-gallery-data");

  if (!image || !controls || !dataEl) {
    return;
  }

  let slides = [];
  try {
    slides = JSON.parse(dataEl.textContent);
  } catch {
    return; // malformed/empty data blob — plain cover <img> stays as-is
  }

  if (!Array.isArray(slides) || slides.length < 1) {
    return; // nothing to show at all — plain cover <img> stays as-is
  }

  const stringFor = (key, fallback) =>
    gallery.querySelector(`.book-gallery-string[data-key="${key}"]`)?.textContent || fallback;

  let index = 0; // slide 0 is the cover, already showing server-side
  let counter = null;

  const showSlide = (newIndex) => {
    // Wraps both directions (Next past the last slide goes back to the
    // cover, Previous before the cover goes to the last slide) — simplest
    // behavior for a small set, no disabled-button states to manage.
    index = (newIndex + slides.length) % slides.length;
    const slide = slides[index];
    image.src = slide.url;
    image.alt = slide.alt || "";
    if (counter) {
      counter.textContent = `${index + 1} / ${slides.length}`;
    }
    updateGalleryModal(gallery, slides, index);
  };

  if (slides.length >= 2) {
    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "book-gallery-arrow book-gallery-prev";
    prevButton.setAttribute("aria-label", stringFor("prev", "Previous image"));

    prevButton.innerHTML = "&#8249;"; // ‹

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "book-gallery-arrow book-gallery-next";
    nextButton.setAttribute("aria-label", stringFor("next", "Next image"));
    nextButton.innerHTML = "&#8250;"; // ›

    counter = document.createElement("span");
    counter.className = "book-gallery-counter";
    // aria-live so a screen reader announces the new position after a click,
    // without needing to re-focus anything.
    counter.setAttribute("aria-live", "polite");

    prevButton.addEventListener("click", () => showSlide(index - 1));
    nextButton.addEventListener("click", () => showSlide(index + 1));

    controls.append(prevButton, counter, nextButton);

    showSlide(0); // sets the counter text; image itself is already slide 0
  }

  // "View Larger Image" — built client-side, like the arrows above, so a
  // visitor without JS never sees a control that can't do anything. Sits
  // right after .book-gallery-controls, so it flows in as a plain block
  // button under the (inline-block-sized) cover image.
  const enlargeLabel = stringFor("enlarge", "View Larger Image");
  const enlargeButton = document.createElement("button");
  enlargeButton.type = "button";
  enlargeButton.className = "book-gallery-enlarge";
  enlargeButton.textContent = enlargeLabel;
  gallery.appendChild(enlargeButton);

  // Bonus click target — same handler, not the only path in (see file
  // header). A native tooltip on hover gives mouse users a hint for why the
  // cursor changed, without needing to make the image itself keyboard-
  // operable (the real button already covers that).
  image.title = enlargeLabel;

  const bookTitle =
    gallery.closest(".wp-block-custom-book")?.querySelector(".book-card-title")?.textContent || "";

  const openEnlarged = (triggerEl) => {
    openGalleryModal({
      gallery,
      slides,
      index,
      triggerEl,
      bookTitle,
      onNavigate: (direction) => showSlide(index + direction),
      strings: {
        close: stringFor("close", "Close"),
        modalLabel: stringFor("modalLabel", "Photos from {title}"),
      },
    });
  };

  enlargeButton.addEventListener("click", () => openEnlarged(enlargeButton));
  image.addEventListener("click", () => openEnlarged(image));
}

document.querySelectorAll(".book-gallery").forEach(initBookGallery);
