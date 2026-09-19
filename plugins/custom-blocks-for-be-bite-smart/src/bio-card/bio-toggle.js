// The photo floats left (see style.css, min-width: 768px) so .bio-short can
// wrap around it. When only a sliver of the photo's height is left over by
// the time .bio-short starts, that produces an awkward, barely-there first
// line instead of a real wrap - push .bio-short below the photo entirely in
// that case rather than let it hug for a fraction of a line.
const BIO_PHOTO_FLOAT_BREAKPOINT = "(min-width: 768px)";

function adjustBioShortWrap() {
  const isFloating = window.matchMedia(BIO_PHOTO_FLOAT_BREAKPOINT).matches;

  document.querySelectorAll(".wp-block-custom-bio-card").forEach((card) => {
    const photo = card.querySelector(".bio-photo");
    const bioShort = card.querySelector(".bio-short");

    if (!photo || !bioShort) return;

    // Clear any previous verdict before re-measuring, so this always judges
    // the browser's own current wrap attempt rather than our last override.
    bioShort.classList.remove("bio-short-below-photo");

    if (!isFloating) return;

    const roomBesidePhoto =
      photo.getBoundingClientRect().bottom - bioShort.getBoundingClientRect().top;
    const lineHeight = parseFloat(getComputedStyle(bioShort).lineHeight) || 0;

    if (roomBesidePhoto > 0 && roomBesidePhoto < lineHeight) {
      bioShort.classList.add("bio-short-below-photo");
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  adjustBioShortWrap();
  if (document.fonts?.ready) {
    document.fonts.ready.then(adjustBioShortWrap);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(adjustBioShortWrap, 150);
  });

  const cards = document.querySelectorAll(".wp-block-custom-bio-card");
  cards.forEach((card, index) => {
    const showMoreBtn = card.querySelector(".show-more-btn");
    const showLessBtn = card.querySelector(".show-less-btn");
    const content = card.querySelector(".expanded-bio-content");
    const section1 = card.querySelector(".bio-section-1");

    if (!showMoreBtn || !showLessBtn || !content) return;

    showMoreBtn.addEventListener("click", () => {
      showMoreBtn.classList.add("hidden");
      content.classList.add("expanded");
    });

    showLessBtn.addEventListener("click", () => {
      content.classList.remove("expanded");
      showMoreBtn.classList.remove("hidden");
      section1.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  // checking if expanded bio is empty
  document.querySelectorAll(".bio-section-2").forEach((section) => {
    const contentEls = [...section.querySelectorAll("p, h2, h3, h4, li, img")];
    const hasContent = contentEls.some(
      (el) => el.tagName === "IMG" || el.textContent.trim().length > 0,
    );

    if (!hasContent) {
      section.style.display = "none";

      const btn = section.closest(".bio-main")?.querySelector(".show-more-btn");

      if (btn) btn.style.display = "none";
    }
  });
});
