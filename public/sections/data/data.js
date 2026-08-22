(() => {
  const grid = document.querySelector(".data-grid");
  if (!grid) return;
  const section = grid.closest("section");
  const bar = document.createElement("div");
  bar.className = "data-progress";
  section.appendChild(bar);
  const update = () => {
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    bar.style.width = `${progress * 100}%`;
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
