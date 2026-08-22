(() => {
  const fine = window.matchMedia("(pointer: fine)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  const reveals = document.querySelectorAll(".reveal");
  if (!reduce) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  if (fine && !reduce) {
    document.body.classList.add("has-cursor");
    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    const ring = document.createElement("div");
    ring.className = "cursor-ring";
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let hover = false;

    const accentAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const section = el?.closest ? el.closest("section[data-accent]") : null;
      return section ? getComputedStyle(section).getPropertyValue("--accent").trim() : null;
    };

    window.addEventListener(
      "mousemove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        const accent = accentAt(mx, my) || "#4f46e5";
        dot.style.setProperty("--accent", accent);
        ring.style.setProperty("--accent", accent);
        hover = e.target.closest ? !!e.target.closest("a, button, .pill, .copy-btn") : false;
        ring.classList.toggle("on", hover);
      },
      { passive: true },
    );

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${hover ? 1.5 : 1})`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  if (fine && !reduce) {
    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.25}px)`;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }

  document.querySelectorAll(".explorer").forEach((explorer) => {
    const tabs = explorer.querySelectorAll(".explorer-tab");
    const select = explorer.querySelector(".explorer-select");
    const panels = explorer.querySelectorAll(".explorer-panel");
    const activate = (key) => {
      tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.explorer === key));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.explorer === key));
      if (select) select.value = key;
    };
    tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab.dataset.explorer)));
    if (select) select.addEventListener("change", () => activate(select.value));
  });

  document.querySelectorAll("pre").forEach((pre) => {
    const code = pre.querySelector("code");
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    btn.textContent = "copy";
    btn.addEventListener("click", () => {
      const text = code ? code.textContent || "" : pre.textContent || "";
      navigator.clipboard
        ?.writeText(text)
        .then(() => {
          btn.textContent = "ok";
          setTimeout(() => {
            btn.textContent = "copy";
          }, 1400);
        })
        .catch(() => {
          btn.textContent = "err";
        });
    });
    pre.appendChild(btn);
  });
})();
