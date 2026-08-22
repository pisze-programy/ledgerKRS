(() => {
  document.querySelectorAll(".use-list li").forEach((li) => {
    li.addEventListener("mouseenter", () => {
      li.style.borderBottomColor = "var(--accent)";
    });
    li.addEventListener("mouseleave", () => {
      li.style.borderBottomColor = "";
    });
  });
})();
