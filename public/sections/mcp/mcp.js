(() => {
  document.querySelectorAll(".tool").forEach((tool) => {
    tool.addEventListener("mouseenter", () => {
      const name = tool.querySelector(".mono");
      if (name) name.style.textDecoration = "underline";
    });
    tool.addEventListener("mouseleave", () => {
      const name = tool.querySelector(".mono");
      if (name) name.style.textDecoration = "";
    });
  });
})();
