document.addEventListener("DOMContentLoaded", function () {
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
      console.log("found btn:", btn); // is this null?
      if (btn) btn.style.display = "none";
    }
  });
});
