/**
 * api-config.js â€” endpoint Google Apps Script (votos + leads)
 *
 * Gui: pegÃ¡ acÃ¡ la URL /exec y el mismo token que API_TOKEN en Apps Script.
 * Si SHEETS_API_URL queda vacÃ­o, voto.js / deck.js usan solo localStorage.
 */
(function (global) {
  "use strict";

  /** Public base used in QR vote links; empty means current deck origin. */
  global.CONGRESO_PUBLIC_BASE = "https://congreso-capital-humano.vercel.app";

  /** @type {string} URL de la Web App (â€¦/macros/s/â€¦/exec) */
  global.SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbwPL2SomUmUZSCbBah0Ls7qLX-1HP0vR4YJgIXF8tI57Pf-tY5bDc1OOkIKeXPo9otE/exec";

  /** @type {string} Debe coincidir con Script Property API_TOKEN */
  global.SHEETS_TOKEN = "congreso-unlam-2026-xK9mQ2";

  var SESSION_KEY = "congreso-session-id";
  var STORAGE_KEY = "congreso-voto-v1";

  function isConfigured() {
    return !!(global.SHEETS_API_URL && String(global.SHEETS_API_URL).trim());
  }

  function getSessionId() {
    try {
      var id = localStorage.getItem(SESSION_KEY);
      if (id) return id;
      id =
        "s-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 10);
      localStorage.setItem(SESSION_KEY, id);
      return id;
    } catch (_) {
      return "anon-" + Date.now().toString(36);
    }
  }

  function postJson(payload) {
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, error: "not_configured", offline: true });
    }
    var body = Object.assign({}, payload, {
      token: global.SHEETS_TOKEN,
      userAgent: (typeof navigator !== "undefined" && navigator.userAgent) || "",
    });
    return fetch(global.SHEETS_API_URL, {
      method: "POST",
      // text/plain evita preflight OPTIONS (Apps Script no lo responde)
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: "bad_json", status: res.status };
      });
    });
  }

  function getJson(params) {
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, error: "not_configured", offline: true });
    }
    var q = new URLSearchParams(
      Object.assign({ token: global.SHEETS_TOKEN }, params)
    );
    var url =
      global.SHEETS_API_URL +
      (global.SHEETS_API_URL.indexOf("?") >= 0 ? "&" : "?") +
      q.toString();
    return fetch(url, { method: "GET", redirect: "follow" }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: "bad_json", status: res.status };
      });
    });
  }

  /** POST vote â†’ sheet votos. Devuelve { ok, tallies?, â€¦ } */
  function submitVote(q, choice) {
    return postJson({
      action: "vote",
      q: q,
      choice: choice,
      sessionId: getSessionId(),
    });
  }

  /** GET tallies. q opcional: "a" | "b" | "all" */
  function fetchTallies(q) {
    return getJson({ action: "tally", q: q || "all" });
  }

  /** POST lead â†’ sheet leads */
  function submitLead(email, source) {
    return postJson({
      action: "lead",
      email: email,
      source: source || "landing",
    });
  }

  function health() {
    return getJson({ action: "health" });
  }

  /* localStorage helpers compartidos (fallback offline) */
  function readLocalStore() {
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

  function writeLocalStore(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function applyLocalVote(q, choice) {
    var store = readLocalStore();
    // Lock: one vote per (session + q); do not allow change
    if (store.last[q]) {
      return store;
    }
    store[q][choice] = (store[q][choice] || 0) + 1;
    store.last[q] = choice;
    writeLocalStore(store);
    return store;
  }

  /**
   * Voto: siempre escribe localStorage; si hay API, tambiÃ©n POST.
   * Si el API responde con tallies, se pueden usar para UI en vivo.
   */
  function voteWithFallback(q, choice) {
    var before = readLocalStore();
    if (before.last[q]) {
      return Promise.resolve({
        ok: true,
        locked: true,
        offline: !isConfigured(),
        store: before,
        tallies: { a: before.a, b: before.b },
        last: before.last,
      });
    }
    var store = applyLocalVote(q, choice);
    if (!isConfigured()) {
      return Promise.resolve({
        ok: true,
        offline: true,
        store: store,
        tallies: { a: store.a, b: store.b },
      });
    }
    return submitVote(q, choice)
      .then(function (res) {
        if (res && res.ok) {
          return {
            ok: true,
            offline: false,
            store: store,
            tallies: mergeTallies(res.tallies, store),
            remote: res,
          };
        }
        return {
          ok: true,
          offline: true,
          store: store,
          tallies: { a: store.a, b: store.b },
          remoteError: (res && res.error) || "api_failed",
        };
      })
      .catch(function (err) {
        return {
          ok: true,
          offline: true,
          store: store,
          tallies: { a: store.a, b: store.b },
          remoteError: String(err && err.message ? err.message : err),
        };
      });
  }

  function mergeTallies(remotePartial, store) {
    var base = {
      a: { si: store.a.si, no: store.a.no, total: store.a.si + store.a.no },
      b: { si: store.b.si, no: store.b.no, total: store.b.si + store.b.no },
    };
    if (!remotePartial) return base;
    ["a", "b"].forEach(function (k) {
      if (remotePartial[k]) {
        base[k] = {
          si: remotePartial[k].si || 0,
          no: remotePartial[k].no || 0,
          total:
            remotePartial[k].total != null
              ? remotePartial[k].total
              : (remotePartial[k].si || 0) + (remotePartial[k].no || 0),
        };
      }
    });
    return base;
  }

  /** Carga tallies remotas; si falla, usa local. */
  function loadTalliesWithFallback(q) {
    var store = readLocalStore();
    var local = {
      a: {
        si: store.a.si,
        no: store.a.no,
        total: store.a.si + store.a.no,
      },
      b: {
        si: store.b.si,
        no: store.b.no,
        total: store.b.si + store.b.no,
      },
    };
    if (!isConfigured()) {
      return Promise.resolve({ ok: true, offline: true, tallies: local, last: store.last });
    }
    return fetchTallies(q || "all")
      .then(function (res) {
        if (res && res.ok && res.tallies) {
          return {
            ok: true,
            offline: false,
            tallies: mergeTallies(res.tallies, store),
            last: store.last,
          };
        }
        return {
          ok: true,
          offline: true,
          tallies: local,
          last: store.last,
          remoteError: (res && res.error) || "api_failed",
        };
      })
      .catch(function (err) {
        return {
          ok: true,
          offline: true,
          tallies: local,
          last: store.last,
          remoteError: String(err && err.message ? err.message : err),
        };
      });
  }

  global.CongresoAPI = {
    STORAGE_KEY: STORAGE_KEY,
    isConfigured: isConfigured,
    getSessionId: getSessionId,
    submitVote: submitVote,
    fetchTallies: fetchTallies,
    submitLead: submitLead,
    health: health,
    readLocalStore: readLocalStore,
    writeLocalStore: writeLocalStore,
    applyLocalVote: applyLocalVote,
    voteWithFallback: voteWithFallback,
    loadTalliesWithFallback: loadTalliesWithFallback,
  };
})(typeof window !== "undefined" ? window : this);
