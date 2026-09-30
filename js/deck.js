/**
 * deck.js - navegación horizontal del deck
 * TEMP (Elio share): operator filtering PAUSED — always show ALL slides.
 * Gui will later re-enable public vs private mode. Do not hide by data-role.
 */
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const host = window.location.hostname;
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "" ||
    window.location.protocol === "file:";
  const forceLocal = params.get("local") === "1";
  /* Kept for future re-enable; currently unused for filtering */
  const MODE_LOCAL = isLocalHost || forceLocal;

  const deck = document.getElementById("deck");
  if (!deck) return;

  /** @type {HTMLElement[]} */
  let slides = Array.from(deck.querySelectorAll(".slide"));

  /* TEMP: do NOT remove operator slides — show all for Elio share */
  // if (!MODE_LOCAL) { ... slide.remove() ... }

  const progressEl = document.getElementById("progress");
  const dotsEl = document.getElementById("dots");
  const counterEl = document.getElementById("slide-counter");
  const btnPrev = document.getElementById("nav-prev");
  const btnNext = document.getElementById("nav-next");
  const modeBadge = document.getElementById("mode-badge");

  let index = 0;
  const total = slides.length;

  if (modeBadge) {
    modeBadge.textContent = "TODAS · filtro pausado";
    modeBadge.hidden = false;
  }

  function buildDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = "";
    slides.forEach(function (slide, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dot";
      btn.setAttribute("aria-label", "Ir a diapositiva " + (i + 1));
      const role = slide.getAttribute("data-role");
      if (role) btn.setAttribute("data-role-hint", role);
      btn.addEventListener("click", function () {
        goTo(i);
      });
      dotsEl.appendChild(btn);
    });
  }

  function updateUI() {
    slides.forEach(function (slide, i) {
      slide.setAttribute("aria-hidden", i === index ? "false" : "true");
    });

    if (dotsEl) {
      Array.from(dotsEl.children).forEach(function (dot, i) {
        if (i === index) {
          dot.setAttribute("aria-current", "true");
        } else {
          dot.removeAttribute("aria-current");
        }
      });
    }

    if (progressEl && total > 1) {
      progressEl.style.width = ((index / (total - 1)) * 100).toFixed(2) + "%";
    } else if (progressEl) {
      progressEl.style.width = "100%";
    }

    if (counterEl) {
      counterEl.textContent =
        String(index + 1).padStart(2, "0") +
        " / " +
        String(total).padStart(2, "0");
    }

    if (btnPrev) btnPrev.disabled = index <= 0;
    if (btnNext) btnNext.disabled = index >= total - 1;

    deck.style.transform = "translateX(-" + index * 100 + "vw)";
  }

  function goTo(i) {
    if (total === 0) return;
    index = Math.max(0, Math.min(total - 1, i));
    updateUI();
  }

  function next() {
    goTo(index + 1);
  }

  function prev() {
    goTo(index - 1);
  }

  if (btnPrev) btnPrev.addEventListener("click", prev);
  if (btnNext) btnNext.addEventListener("click", next);

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(total - 1);
    }
  });

  /* Swipe táctil opcional */
  let touchX = null;
  deck.addEventListener(
    "touchstart",
    function (e) {
      if (e.changedTouches && e.changedTouches[0]) {
        touchX = e.changedTouches[0].screenX;
      }
    },
    { passive: true }
  );
  deck.addEventListener(
    "touchend",
    function (e) {
      if (touchX === null || !e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].screenX - touchX;
      touchX = null;
      if (Math.abs(dx) < 50) return;
      if (dx < 0) next();
      else prev();
    },
    { passive: true }
  );

  /* Evitar scroll bleed / rueda horizontal */
  document.addEventListener(
    "wheel",
    function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10) {
        e.preventDefault();
        if (e.deltaX > 0) next();
        else prev();
      }
    },
    { passive: false }
  );

  /* Tabs internas en slide de diálogo (Opción 1/2/3) — no cambian de slide */
  document.querySelectorAll("[data-option-tabs]").forEach(function (root) {
    const tabs = Array.from(root.querySelectorAll("[data-option-tab]"));
    const panels = Array.from(root.querySelectorAll("[data-option-panel]"));

    function activate(id) {
      tabs.forEach(function (tab) {
        const on = tab.getAttribute("data-option-tab") === id;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.classList.toggle("is-active", on);
      });
      panels.forEach(function (panel) {
        const on = panel.getAttribute("data-option-panel") === id;
        panel.hidden = !on;
        panel.classList.toggle("is-active", on);
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activate(tab.getAttribute("data-option-tab"));
      });
    });

    const initial =
      (tabs.find(function (t) {
        return t.getAttribute("aria-selected") === "true";
      }) &&
        tabs
          .find(function (t) {
            return t.getAttribute("aria-selected") === "true";
          })
          .getAttribute("data-option-tab")) ||
      (tabs[0] && tabs[0].getAttribute("data-option-tab")) ||
      "1";
    activate(initial);
  });

  buildDots();
  goTo(0);

  window.__deck = {
    mode: "all",
    filterPaused: true,
    localHost: MODE_LOCAL,
    goTo: goTo,
    next: next,
    prev: prev,
    total: total,
  };
})();
