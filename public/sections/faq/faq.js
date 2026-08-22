(() => {
  document.querySelectorAll(".faq-q").forEach((q) => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      const isOpen = item.classList.toggle("open");
      q.setAttribute("aria-expanded", String(isOpen));
    });
  });
})();
