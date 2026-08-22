(() => {
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("mouseenter", () => {
      chip.style.background = "var(--accent)";
      chip.style.color = "#fff";
    });
    chip.addEventListener("mouseleave", () => {
      chip.style.background = "";
      chip.style.color = "";
    });
  });
})();
