(() => {
  document.querySelectorAll(".api-q").forEach((q) => {
    q.addEventListener("click", () => {
      const item = q.closest(".api-item");
      const open = item.classList.toggle("open");
      q.setAttribute("aria-expanded", String(open));
    });
  });
})();
