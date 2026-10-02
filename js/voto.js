/**
 * voto.js — votación (Apps Script + localStorage fallback) para Truco CV
 * URL: /voto/?q=a | /voto/?q=b
 *
 * Reglas:
 * - sessionId estable por perfil de navegador (localStorage).
 * - Un voto por (sessionId + q). A y B son independientes (hasta 2 por sesión).
 * - Cambiar SÍ↔NO en el mismo q sobrescribe (backend dedupea sessionId+q).
 * - Abrir otro perfil/navegador = otra sesión = nuevos votos.
 *
 * Requiere js/api-config.js (window.CongresoAPI).
 */
(function () {
  "use strict";

  var API = window.CongresoAPI;
  var params = new URLSearchParams(window.location.search);
  var q = (params.get("q") || "a").toLowerCase();
  if (q !== "a" && q !== "b") q = "a";
  var tallyView = params.get("view") === "tally";
  if (document.body) document.body.classList.toggle("voto-view-tally", tallyView);
  var otherQ = q === "a" ? "b" : "a";

  var META = {
    a: {
      label: "Perfil A",
      name: "Valentina Morales",
      question: "¿Avanza Valentina a entrevista?",
    },
    b: {
      label: "Perfil B",
      name: "Brian Gómez",
      question: "¿Avanza Brian a entrevista?",
    },
  };

  var tagEl = document.getElementById("voto-profile-tag");
  var titleEl = document.getElementById("voto-title");
  var qEl = document.getElementById("voto-question");
  var statusEl = document.getElementById("voto-status");
  var actionsEl = document.getElementById("voto-actions");
  var otherEl = document.getElementById("voto-other");
  var countSiEl = document.getElementById("voto-count-si");
  var countNoEl = document.getElementById("voto-count-no");
  var barSiEl = document.getElementById("voto-bar-si");
  var barNoEl = document.getElementById("voto-bar-no");
  var totalEl = document.getElementById("voto-tally-total");
  var sourceEl = document.getElementById("voto-tally-source");
  var noteEl = document.querySelector(".stub-note");
  var tallyEl = document.getElementById("voto-tally");
  var resetEl = document.getElementById("voto-reset");
  if (tallyEl) tallyEl.hidden = !tallyView;
  if (resetEl) resetEl.hidden = !tallyView;

  document.title = META[q].label + " · " + META[q].name + " | Votación";

  if (tagEl) tagEl.textContent = META[q].label;
  if (titleEl) titleEl.textContent = META[q].name;
  if (qEl) qEl.textContent = META[q].question;
  if (otherEl) {
    otherEl.href = "?q=" + otherQ;
    otherEl.textContent =
      "Ir al " + META[otherQ].label + " · " + META[otherQ].name + " →";
  }

  if (noteEl && API && API.isConfigured()) {
    noteEl.innerHTML =
      "Un voto por perfil en esta sesión (A y B independientes). Podés cambiar tu voto tocando la otra opción. Los votos van al Sheet; si falla la red, quedan en este navegador.";
  }

  var lastTallies = { a: { si: 0, no: 0 }, b: { si: 0, no: 0 } };
  var lastChoice = null;
  var busy = false;
  var offlineMode = !(API && API.isConfigured());
  var justVoted = false;

  function choiceLabel(c) {
    return c === "si" ? "SÍ" : "NO";
  }

  function renderConfirm() {
    if (!statusEl) return;
    if (!lastChoice) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.className = "voto-confirm";
      return;
    }
    statusEl.hidden = false;
    statusEl.className =
      "voto-confirm voto-confirm--" +
      (lastChoice === "si" ? "si" : "no") +
      (justVoted ? " voto-confirm--flash" : "");
    statusEl.innerHTML =
      '<span class="voto-confirm__check" aria-hidden="true">✓</span>' +
      '<span class="voto-confirm__text">Tu voto quedó registrado: <strong>' +
      choiceLabel(lastChoice) +
      "</strong></span>" +
      '<span class="voto-confirm__hint">Podés cambiarlo tocando la otra opción · solo este perfil</span>';
  }

  function renderTally() {
    var tallies = lastTallies[q] || { si: 0, no: 0 };
    var si = tallies.si || 0;
    var no = tallies.no || 0;
    var total = si + no;
    var pctSi = total ? Math.round((si / total) * 100) : 0;
    var pctNo = total ? 100 - pctSi : 0;

    if (countSiEl) countSiEl.textContent = String(si);
    if (countNoEl) countNoEl.textContent = String(no);
    if (barSiEl) barSiEl.style.width = pctSi + "%";
    if (barNoEl) barNoEl.style.width = pctNo + "%";
    if (totalEl) {
      totalEl.textContent =
        total === 1 ? "1 voto" : total + " votos";
    }
    if (sourceEl) {
      sourceEl.textContent = offlineMode
        ? "Fuente: este navegador (local)"
        : "Fuente: Sheet en vivo · se actualiza sola";
    }
  }

  function renderButtons() {
    if (!actionsEl) return;
    actionsEl.querySelectorAll(".vote-opt").forEach(function (btn) {
      var choice = btn.getAttribute("data-choice");
      var selected = lastChoice === choice;
      btn.classList.toggle("is-selected", selected);
      btn.classList.toggle("is-voted", !!lastChoice);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
      btn.disabled = busy;
    });
    if (actionsEl) {
      actionsEl.classList.toggle("voto-actions--voted", !!lastChoice);
    }
  }

  function render() {
    renderConfirm();
    renderTally();
    renderButtons();
  }

  function applyResult(result) {
    if (result.tallies) {
      if (result.tallies.a) lastTallies.a = result.tallies.a;
      if (result.tallies.b) lastTallies.b = result.tallies.b;
    }
    if (result.last && result.last[q]) {
      lastChoice = result.last[q];
    } else if (result.store && result.store.last) {
      lastChoice = result.store.last[q] || lastChoice;
    }
    if (typeof result.offline === "boolean") {
      offlineMode = result.offline;
    }
    render();
  }

  function refreshFromApi() {
    if (!API) {
      render();
      return;
    }
    API.loadTalliesWithFallback(q).then(function (result) {
      applyResult(result);
    });
  }

  if (actionsEl) {
    actionsEl.querySelectorAll(".vote-opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var choice = btn.getAttribute("data-choice");
        if (choice !== "si" && choice !== "no") return;
        if (busy || !API) return;
        if (lastChoice === choice) {
          // Ya votó esa opción: reforzar confirmación sin re-enviar
          justVoted = true;
          render();
          setTimeout(function () {
            justVoted = false;
            renderConfirm();
          }, 900);
          return;
        }
        busy = true;
        justVoted = false;
        render();
        API.voteWithFallback(q, choice).then(function (result) {
          busy = false;
          lastChoice = choice;
          justVoted = true;
          applyResult(result);
          setTimeout(function () {
            justVoted = false;
            renderConfirm();
          }, 1200);
        });
      });
    });
  }

  var resetBtn = document.getElementById("voto-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (
        !confirm(
          "¿Borrar tallies locales de A y B en este dispositivo? (No borra el Sheet)"
        )
      )
        return;
      if (API) {
        API.writeLocalStore({
          a: { si: 0, no: 0 },
          b: { si: 0, no: 0 },
          last: {},
        });
      }
      lastChoice = null;
      justVoted = false;
      refreshFromApi();
    });
  }

  // bootstrap: local inmediato + refresh remoto
  if (API) {
    var local = API.readLocalStore();
    lastTallies = {
      a: {
        si: local.a.si,
        no: local.a.no,
        total: local.a.si + local.a.no,
      },
      b: {
        si: local.b.si,
        no: local.b.no,
        total: local.b.si + local.b.no,
      },
    };
    lastChoice = local.last[q] || null;
  }
  render();
  refreshFromApi();

  // Poll en vivo siempre (Sheet o local) cada 4s
  setInterval(refreshFromApi, 4000);
})();
