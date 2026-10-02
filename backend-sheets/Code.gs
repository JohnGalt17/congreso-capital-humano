/**
 * Congreso UNLaM / John Galt — API de votos + leads (Google Sheets)
 * Pegar en Extensiones → Apps Script del Spreadsheet del evento.
 *
 * Acciones:
 *   POST { action:"vote", token, q:"a"|"b", choice:"si"|"no", sessionId? }
 *   POST { action:"lead", token, email, source? }
 *   GET  ?action=tally&token=...&q=a|b|all
 *   GET  ?action=health&token=...
 *
 * Token: Propiedad del script API_TOKEN (Archivo → Propiedades del proyecto)
 * o editar DEFAULT_TOKEN abajo.
 *
 * CORS: el cliente debe enviar POST con Content-Type: text/plain
 * (evita preflight OPTIONS que Apps Script no responde).
 */

var SHEET_VOTOS = 'votos';
var SHEET_LEADS = 'leads';
var DEFAULT_TOKEN = 'CAMBIAR_ESTE_TOKEN';

/* ── Entrypoints ─────────────────────────────────────────────── */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!checkToken_(p.token)) {
      return jsonOut_({ ok: false, error: 'unauthorized' }, 401);
    }
    var action = String(p.action || 'health').toLowerCase();
    if (action === 'health') {
      return jsonOut_({
        ok: true,
        service: 'congreso-votos',
        sheets: { votos: SHEET_VOTOS, leads: SHEET_LEADS },
      });
    }
    if (action === 'tally') {
      return jsonOut_({ ok: true, tallies: getTallies_(p.q) });
    }
    return jsonOut_({ ok: false, error: 'unknown_action' }, 400);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err) }, 500);
  }
}

function doPost(e) {
  try {
    var body = parseBody_(e);
    if (!checkToken_(body.token)) {
      return jsonOut_({ ok: false, error: 'unauthorized' }, 401);
    }
    var action = String(body.action || '').toLowerCase();
    if (action === 'vote') {
      return jsonOut_(handleVote_(body));
    }
    if (action === 'lead') {
      return jsonOut_(handleLead_(body));
    }
    return jsonOut_({ ok: false, error: 'unknown_action' }, 400);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err) }, 500);
  }
}

/* ── Handlers ────────────────────────────────────────────────── */

function handleVote_(body) {
  var q = String(body.q || '').toLowerCase();
  var choice = normalizeChoice_(body.choice);
  if (q !== 'a' && q !== 'b') {
    return { ok: false, error: 'invalid_q' };
  }
  if (!choice) {
    return { ok: false, error: 'invalid_choice' };
  }
  var sessionId = String(body.sessionId || '').trim() || Utilities.getUuid();
  var ua = String(body.userAgent || '').substring(0, 300);
  var sheet = ensureSheet_(SHEET_VOTOS, [
    'timestamp',
    'q',
    'choice',
    'sessionId',
    'userAgent',
  ]);

  var rowIndex = findVoteRow_(sheet, sessionId, q);
  var ts = new Date();
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, rowIndex, 5).setValues([
      [ts, q, choice, sessionId, ua],
    ]);
  } else {
    sheet.appendRow([ts, q, choice, sessionId, ua]);
  }

  return {
    ok: true,
    action: 'vote',
    q: q,
    choice: choice,
    sessionId: sessionId,
    updated: rowIndex > 0,
    tallies: getTallies_(q),
  };
}

function handleLead_(body) {
  var email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!email || email.indexOf('@') < 1) {
    return { ok: false, error: 'invalid_email' };
  }
  var source = String(body.source || 'landing').substring(0, 80);
  var ua = String(body.userAgent || '').substring(0, 300);
  var sheet = ensureSheet_(SHEET_LEADS, [
    'timestamp',
    'email',
    'source',
    'userAgent',
  ]);
  sheet.appendRow([new Date(), email, source, ua]);
  return { ok: true, action: 'lead', email: email };
}

/* ── Tallies ─────────────────────────────────────────────────── */

function getTallies_(qFilter) {
  var sheet = ensureSheet_(SHEET_VOTOS, [
    'timestamp',
    'q',
    'choice',
    'sessionId',
    'userAgent',
  ]);
  var result = {
    a: { si: 0, no: 0, total: 0 },
    b: { si: 0, no: 0, total: 0 },
  };
  var last = sheet.getLastRow();
  if (last < 2) {
    return filterTallies_(result, qFilter);
  }
  var data = sheet.getRange(2, 1, last, 4).getValues();
  // Una fila por sessionId+q (ya dedupeada al escribir); contar todas
  for (var i = 0; i < data.length; i++) {
    var q = String(data[i][1] || '').toLowerCase();
    var choice = normalizeChoice_(data[i][2]);
    if ((q !== 'a' && q !== 'b') || !choice) continue;
    result[q][choice] += 1;
    result[q].total += 1;
  }
  return filterTallies_(result, qFilter);
}

function filterTallies_(all, qFilter) {
  var q = String(qFilter || 'all').toLowerCase();
  if (q === 'a' || q === 'b') {
    var out = {};
    out[q] = all[q];
    return out;
  }
  return all;
}

/* ── Sheet helpers ───────────────────────────────────────────── */

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'No hay Spreadsheet activo. Creá el script desde el Sheet o seteá SPREADSHEET_ID.'
    );
  }
  return ss;
}

function ensureSheet_(name, headers) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  } else {
    // Si existe pero sin headers esperados, no destruir datos
    var first = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (!first[0] || String(first[0]).toLowerCase() !== String(headers[0]).toLowerCase()) {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  }
  return sheet;
}

function findVoteRow_(sheet, sessionId, q) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var data = sheet.getRange(2, 2, last, 4).getValues(); // q, choice, sessionId
  for (var i = data.length - 1; i >= 0; i--) {
    var rowQ = String(data[i][0] || '').toLowerCase();
    var rowSid = String(data[i][2] || '');
    if (rowQ === q && rowSid === sessionId) {
      return i + 2; // 1-indexed + header
    }
  }
  return -1;
}

/* ── Auth / utils ────────────────────────────────────────────── */

function checkToken_(token) {
  var expected =
    PropertiesService.getScriptProperties().getProperty('API_TOKEN') ||
    DEFAULT_TOKEN;
  if (!expected || expected === 'CAMBIAR_ESTE_TOKEN') {
    // Si no configuraron token, aceptar solo si el placeholder coincide
    // (Gui debe setear API_TOKEN antes del evento)
  }
  return String(token || '') === String(expected);
}

function normalizeChoice_(c) {
  var s = String(c || '')
    .toLowerCase()
    .trim();
  if (s === 'si' || s === 'sí' || s === 'yes' || s === 'y' || s === '1') return 'si';
  if (s === 'no' || s === 'n' || s === '0') return 'no';
  return null;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    // También aceptar parámetros de form
    return (e && e.parameter) || {};
  }
  var raw = e.postData.contents;
  try {
    return JSON.parse(raw);
  } catch (_) {
    // application/x-www-form-urlencoded ya viene en e.parameter
    return (e && e.parameter) || {};
  }
}

function jsonOut_(obj, _statusIgnored) {
  // ContentService no expone status HTTP real en Web Apps;
  // el cliente mira obj.ok / obj.error.
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Utilidad opcional: correr una vez desde el editor para setear token.
 * Reemplazar el string y Ejecutar → setApiToken
 */
function setApiToken() {
  PropertiesService.getScriptProperties().setProperty(
    'API_TOKEN',
    'CAMBIAR_ESTE_TOKEN'
  );
}
