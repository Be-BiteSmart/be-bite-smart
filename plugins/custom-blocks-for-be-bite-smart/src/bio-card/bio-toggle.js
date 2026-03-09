document.addEventListener("DOMContentLoaded", function () {
  const cards = document.querySelectorAll(".wp-block-custom-bio-card");
  cards.forEach((card, index) => {
    const showMoreBtn = card.querySelector(".show-more-btn");
    const showLessBtn = card.querySelector(".show-less-btn");
    const content = card.querySelector(".expanded-bio-content");
    const section1 = card.querySelector(".bio-section-1");

    if (!showMoreBtn || !showLessBtn || !content) return;

    // Give each section 1 a unique id
    section1.id = `bio-section-1-${index}`;

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
});
