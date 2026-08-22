(() => {
  const terminal = document.querySelector(".api-split");
  if (!terminal) return;
  const blocks = terminal.querySelectorAll("pre, .api-note");
  terminal.addEventListener("mouseenter", () => {
    blocks.forEach((block) => {
      block.style.boxShadow = "0 0 0 1px var(--accent)";
    });
  });
  terminal.addEventListener("mouseleave", () => {
    blocks.forEach((block) => {
      block.style.boxShadow = "";
    });
  });
})();
