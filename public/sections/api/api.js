(() => {
  const tabs = document.querySelectorAll(".explorer-tab");
  if (!tabs.length) return;
  const sync = () => {
    tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.classList.contains("active"))));
  };
  sync();
  tabs.forEach((tab) => {
    new MutationObserver(sync).observe(tab, { attributes: true, attributeFilter: ["class"] });
  });
  const explorer = document.querySelector(".explorer");
  if (explorer) {
    explorer.setAttribute("role", "tablist");
    const select = explorer.querySelector(".explorer-select");
    if (select) select.setAttribute("aria-label", "endpoint");
  }
})();
