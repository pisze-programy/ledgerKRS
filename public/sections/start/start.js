(() => {
  document.querySelectorAll(".step").forEach((step) => {
    step.addEventListener("mouseenter", () => {
      const num = step.querySelector(".step-num");
      if (num) num.style.background = "var(--accent)";
    });
    step.addEventListener("mouseleave", () => {
      const num = step.querySelector(".step-num");
      if (num) num.style.background = "";
    });
  });
})();
