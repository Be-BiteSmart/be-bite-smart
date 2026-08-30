// Front-end behavior for custom/book's optional "Inside the Book" preview
// carousel — see bitesmart_book_cover_gallery() in book-display.php for the
// server side. Deliberately NOT a fetch()/REST call, and deliberately NOT
// rendering every slide as a real <img> up front: only the cover (slide 0)
// is ever downloaded automatically on page load. Every other slide's
// url/alt sits inert in a <script type="application/json"> blob until a
// visitor actually clicks Next — a real lazy-load (zero bytes for a slide
// nobody views), kinder to a worldwide/bandwidth-constrained audience than
// the native `loading="lazy"` attribute alone, which doesn't reliably defer
// images that start out hidden.
//
// Page-wide selector (not block-instance-scoped), same convention as
// view.js/browse.js — a page can show several book cards at once (e.g. the
// Books List page, custom/books-list), each with its own independent
// gallery.

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

  if (!Array.isArray(slides) || slides.length < 2) {
    return; // nothing to browse — plain cover <img> stays as-is, no arrows added
  }

  const stringFor = (key, fallback) =>
    gallery.querySelector(`.book-gallery-string[data-key="${key}"]`)?.textContent || fallback;

  let index = 0; // slide 0 is the cover, already showing server-side

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "book-gallery-arrow book-gallery-prev";
  prevButton.setAttribute("aria-label", stringFor("prev", "Previous image"));
  prevButton.setAttribute("aria-hidden", "false");
  prevButton.innerHTML = "&#8249;"; // ‹

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "book-gallery-arrow book-gallery-next";
  nextButton.setAttribute("aria-label", stringFor("next", "Next image"));
  nextButton.innerHTML = "&#8250;"; // ›

  const counter = document.createElement("span");
  counter.className = "book-gallery-counter";
  // aria-live so a screen reader announces the new position after a click,
  // without needing to re-focus anything.
  counter.setAttribute("aria-live", "polite");

  const showSlide = (newIndex) => {
    // Wraps both directions (Next past the last slide goes back to the
    // cover, Previous before the cover goes to the last slide) — simplest
    // behavior for a small set, no disabled-button states to manage.
    index = (newIndex + slides.length) % slides.length;
    const slide = slides[index];
    image.src = slide.url;
    image.alt = slide.alt || "";
    counter.textContent = `${index + 1} / ${slides.length}`;
  };

  prevButton.addEventListener("click", () => showSlide(index - 1));
  nextButton.addEventListener("click", () => showSlide(index + 1));

  controls.appendChild(prevButton);
  controls.appendChild(counter);
  controls.appendChild(nextButton);

  showSlide(0); // sets the counter text; image itself is already slide 0
}

document.querySelectorAll(".book-gallery").forEach(initBookGallery);
