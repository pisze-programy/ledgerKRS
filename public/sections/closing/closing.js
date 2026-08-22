(() => {
  const big = document.querySelector(".closing-big");
  if (!big || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.addEventListener(
    "scroll",
    () => {
      const rect = big.getBoundingClientRect();
      const mid = window.innerHeight / 2;
      const offset = Math.max(-20, Math.min(20, (mid - rect.top) * 0.06));
      big.style.transform = `translateY(${offset}px)`;
    },
    { passive: true },
  );
})();
