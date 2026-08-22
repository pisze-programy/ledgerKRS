(() => {
  document.querySelectorAll(".flow").forEach((flow) => {
    const tag = flow.querySelector(".flow-tag");
    if (!tag) return;
    flow.addEventListener("mouseenter", () => {
      tag.style.background = "var(--accent)";
      tag.style.color = "#fff";
    });
    flow.addEventListener("mouseleave", () => {
      tag.style.background = "";
      tag.style.color = "";
    });
  });
})();
