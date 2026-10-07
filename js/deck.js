/**
 * deck.js - navegación horizontal del deck
 * TEMP (Elio share): operator filtering PAUSED — always show ALL slides.
 * Gui will later re-enable public vs private mode. Do not hide by data-role.
 * + video pause on slide change
 * + votos: live tallies only on deck (cast from /voto/ phone)
 */
(function () {
  "use strict";

  var API = window.CongresoAPI;
  var STORAGE_KEY = (API && API.STORAGE_KEY) || "congreso-voto-v1";
  var params = new URLSearchParams(window.location.search);
  var host = window.location.hostname;
  var isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "" ||
    window.location.protocol === "file:";
  var forceLocal = params.get("local") === "1";
  /* Kept for future re-enable; currently unused for filtering */
  var MODE_LOCAL = isLocalHost || forceLocal;

  var deck = document.getElementById("deck");
  if (!deck) return;

  /** @type {HTMLElement[]} */
  var slides = Array.from(deck.querySelectorAll(".slide"));

  /* TEMP: do NOT remove operator slides — show all for Elio share */
  // if (!MODE_LOCAL) { ... slide.remove() ... }

  var progressEl = document.getElementById("progress");
  var dotsEl = document.getElementById("dots");
  var counterEl = document.getElementById("slide-counter");
  var btnPrev = document.getElementById("nav-prev");
  var btnNext = document.getElementById("nav-next");
  var modeBadge = document.getElementById("mode-badge");

  var index = 0;
  var total = slides.length;
  var remoteTallies = null;

  function voteUrlFor(q) {
    var configuredBase = String(window.CONGRESO_PUBLIC_BASE || "").trim();
    var base = configuredBase
      ? configuredBase.replace(/\/+$/, "")
      : window.location.origin;
    return base + "/voto/?q=" + encodeURIComponent(q);
  }

  function initVoteQRCodes() {
    document.querySelectorAll("[data-vote-qr]").forEach(function (figure) {
      var q = figure.getAttribute("data-vote-qr");
      if (q !== "a" && q !== "b") return;
      var url = voteUrlFor(q);
      var image = figure.querySelector("[data-vote-qr-image]");
      var urlText = figure.querySelector("[data-vote-url-text]");
      if (image) {
        image.src =
          "https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=" +
          encodeURIComponent(url);
        image.alt = "C?digo QR para votar Perfil " + q.toUpperCase();
      }
      if (urlText) urlText.textContent = url;
    });
  }

  if (modeBadge) {
    modeBadge.textContent = "TODAS · filtro pausado";
    modeBadge.hidden = false;
  }

  function readStore() {
    if (API) return API.readLocalStore();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { a: { si: 0, no: 0 }, b: { si: 0, no: 0 }, last: {} };
      var data = JSON.parse(raw);
      return {
        a: { si: data.a?.si || 0, no: data.a?.no || 0 },
        b: { si: data.b?.si || 0, no: data.b?.no || 0 },
        last: data.last || {},
      };
    } catch (_) {
      return { a: { si: 0, no: 0 }, b: { si: 0, no: 0 }, last: {} };
    }
  }

  function writeStore(data) {
    if (API) {
      API.writeLocalStore(data);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      /* file:// private mode etc. */
    }
  }

  function pauseAllVideos() {
    deck.querySelectorAll("video").forEach(function (v) {
      try {
        v.pause();
      } catch (_) {}
    });
  }

  function buildDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = "";
    slides.forEach(function (slide, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dot";
      btn.setAttribute("aria-label", "Ir a diapositiva " + (i + 1));
      var role = slide.getAttribute("data-role");
      if (role) btn.setAttribute("data-role-hint", role);
      btn.addEventListener("click", function () {
        goTo(i);
      });
      dotsEl.appendChild(btn);
    });
  }

  function updateUI() {
    pauseAllVideos();

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
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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
    } else if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      playBell();
    }
  });

  /* Campana de box: tecla C o boton, en cualquier slide, cuantas veces se quiera */
  var bellSrc = new Audio("assets/campana.mp3");
  bellSrc.preload = "auto";
  function playBell() {
    try {
      var a = bellSrc.cloneNode(true);
      a.volume = 1;
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (_) {}
  }
  var btnBell = document.getElementById("bell-btn");
  if (btnBell) btnBell.addEventListener("click", function (e) {
    e.preventDefault();
    playBell();
    btnBell.blur();
  });

  /* Swipe táctil opcional */
  var touchX = null;
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
      var dx = e.changedTouches[0].screenX - touchX;
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
    var tabs = Array.from(root.querySelectorAll("[data-option-tab]"));
    var panels = Array.from(root.querySelectorAll("[data-option-panel]"));

    function activate(id) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-option-tab") === id;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.classList.toggle("is-active", on);
      });
      panels.forEach(function (panel) {
        var on = panel.getAttribute("data-option-panel") === id;
        panel.hidden = !on;
        panel.classList.toggle("is-active", on);
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activate(tab.getAttribute("data-option-tab"));
      });
    });

    var initial =
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

  function talliesFor(q) {
    if (remoteTallies && remoteTallies[q]) return remoteTallies[q];
    var store = readStore();
    var t = store[q] || { si: 0, no: 0 };
    return {
      si: t.si || 0,
      no: t.no || 0,
      total: (t.si || 0) + (t.no || 0),
    };
  }

  /* Votos: deck + mismo store que /voto/; API si está configurada */
  function fillTallyPanel(panel, tallies, sourceLabel) {
    if (!panel) return;
    var si = tallies.si || 0;
    var no = tallies.no || 0;
    var total = si + no;
    var pctSi = total ? Math.round((si / total) * 100) : 0;
    var pctNo = total ? 100 - pctSi : 0;
    var siEl = panel.querySelector("[data-tally-si]");
    var noEl = panel.querySelector("[data-tally-no]");
    var totalEl = panel.querySelector("[data-tally-total]");
    var barSi = panel.querySelector("[data-tally-bar-si]");
    var barNo = panel.querySelector("[data-tally-bar-no]");
    var sourceEl = panel.querySelector("[data-tally-source]");
    if (siEl) siEl.textContent = String(si);
    if (noEl) noEl.textContent = String(no);
    if (totalEl) {
      totalEl.textContent = total === 1 ? "1 voto" : total + " votos";
    }
    if (barSi) barSi.style.width = pctSi + "%";
    if (barNo) barNo.style.width = pctNo + "%";
    if (sourceEl) sourceEl.textContent = sourceLabel || "";
  }

  /* Projector: live tallies only — no casting from the big screen */
  function refreshDeckVotes() {
    var sourceLabel =
      API && API.isConfigured() && remoteTallies
        ? "Fuente: Sheet en vivo"
        : "Fuente: este navegador (local)";

    document.querySelectorAll("[data-deck-tally]").forEach(function (panel) {
      var q = panel.getAttribute("data-deck-tally");
      fillTallyPanel(panel, talliesFor(q), sourceLabel);
    });
  }



  function pullRemoteTallies() {
    if (!API) {
      refreshDeckVotes();
      return;
    }
    API.loadTalliesWithFallback("all").then(function (result) {
      if (result.tallies) remoteTallies = result.tallies;
      refreshDeckVotes();
    });
  }

  initVoteQRCodes();
  buildDots();
  goTo(0);
  refreshDeckVotes();
  pullRemoteTallies();
  setInterval(pullRemoteTallies, 4000);

  window.__deck = {
    mode: "all",
    filterPaused: true,
    localHost: MODE_LOCAL,
    goTo: goTo,
    next: next,
    prev: prev,
    total: total,
    voteStoreKey: STORAGE_KEY,
    refreshVotes: refreshDeckVotes,
    pullTallies: pullRemoteTallies,
  };
})();
