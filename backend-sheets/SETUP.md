# Backend Google Sheets + Apps Script — Congreso UNLaM

Guía corta para Gui: votos en vivo + captura de emails (newsletter / feedback) sin Vercel ni servidor propio.

## Qué hace

| Acción | Método | Resultado |
|--------|--------|-----------|
| Votar | `POST` `{ action:"vote", token, q, choice, sessionId }` | Fila en hoja `votos` (1 voto por `sessionId`+`q`; se actualiza si vuelve a votar) |
| Tally | `GET` `?action=tally&token=...&q=a\|b\|all` | `{ a:{si,no,total}, b:{si,no,total} }` |
| Lead | `POST` `{ action:"lead", token, email, source? }` | Fila en hoja `leads` |
| Health | `GET` `?action=health&token=...` | Ping de sanity |

Columnas:

- **votos:** `timestamp | q | choice | sessionId | userAgent`
- **leads:** `timestamp | email | source | userAgent`

---

## Pasos de deploy (Apps Script)

1. **Crear el Sheet**  
   Google Drive → Nuevo → Hojas de cálculo.  
   Nombre sugerido: `Congreso UNLaM — votos 2026`.  
   (Opcional) Creá a mano las pestañas `votos` y `leads`; si no existen, el script las crea al primer request.

2. **Abrir Apps Script**  
   En el Sheet: **Extensiones → Apps Script**.  
   Borrá el `Código.gs` vacío y pegá el contenido de `backend-sheets/Code.gs`.  
   Guardá el proyecto (Ctrl+S). Nombre del proyecto: `congreso-votos-api`.

3. **Setear el token secreto**  
   En el editor de Apps Script:  
   - **Proyecto → Configuración del proyecto** (engranaje) → **Propiedades del script** → Agregar  
   - Propiedad: `API_TOKEN`  
   - Valor: un string largo al azar (ej. generá con un password manager)  
   Alternativa rápida: editá la función `setApiToken()` al final de `Code.gs`, poné tu token, seleccioná `setApiToken` en el desplegable y **Ejecutar** una vez. Después podés borrar esa función.

4. **Desplegar como Web App**  
   - **Implementar → Nueva implementación**  
   - Tipo: **Aplicación web**  
   - Descripción: `v1 votos congreso`  
   - Ejecutar como: **Yo** (tu cuenta)  
   - Quién tiene acceso: **Cualquier persona** (Anyone)  
   - **Implementar** → autorizá los permisos la primera vez (acceso al Sheet)  
   - Copiá la **URL de la aplicación web** (termina en `/exec`)

5. **Configurar el landing**  
   En `js/api-config.js` del landing:

   ```js
   window.SHEETS_API_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
   window.SHEETS_TOKEN   = "tu-mismo-token-de-API_TOKEN";
   ```

   Abrí `/voto/?q=a`, votá, y mirá la pestaña `votos` del Sheet.  
   Tally: `/voto/?q=a&view=tally` (también pide al API si está configurado).

---

## Qué pegar en el landing

| Variable | Dónde | Qué va |
|----------|-------|--------|
| `SHEETS_API_URL` | `js/api-config.js` | URL `/exec` de la Web App |
| `SHEETS_TOKEN` | `js/api-config.js` | Mismo valor que `API_TOKEN` en Script Properties |

Si dejás `SHEETS_API_URL` vacío, el landing sigue en modo **solo localStorage** (offline / ensayo sin Sheet).

---

## CORS / fetch desde el browser

Apps Script no responde bien a preflight `OPTIONS`. El cliente (`api-config.js`) envía POST con:

```http
Content-Type: text/plain;charset=utf-8
```

y body JSON. GET de tallies usa querystring normal. Funciona desde `localhost`, `file://` (limitado) y el dominio Vercel cuando lo publiques.

---

## Captura de email (lead) — dónde va

Hoy el deck termina en la slide 16 (cierre del truco CV). **No hay slide JG links todavía.**

Para no sobre-armar UI sin aprobación:

1. Helper listo: `window.CongresoAPI.submitLead(email, source)` en `api-config.js`.
2. Cuando armes la slide de cierre / newsletter, un form mínimo alcanza:

```html
<form id="lead-form" class="lead-form">
  <label for="lead-email">Dejá tu mail</label>
  <input id="lead-email" type="email" required placeholder="vos@empresa.com">
  <button type="submit">Quiero novedades</button>
  <p id="lead-status" aria-live="polite"></p>
</form>
```

```js
document.getElementById("lead-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("lead-email").value;
  const status = document.getElementById("lead-status");
  status.textContent = "Enviando…";
  const r = await window.CongresoAPI.submitLead(email, "cierre-deck");
  status.textContent = r.ok ? "¡Listo, gracias!" : "No se pudo enviar. Probá de nuevo.";
});
```

Podés meter eso en slide 16 o en una slide 17 nueva cuando Gui lo pida.

---

## Probar sin el landing

Health:

```
GET {URL}?action=health&token=TU_TOKEN
```

Tally:

```
GET {URL}?action=tally&token=TU_TOKEN&q=all
```

Vote (desde consola del browser o curl):

```js
fetch(SHEETS_API_URL, {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify({
    action: "vote",
    token: SHEETS_TOKEN,
    q: "a",
    choice: "si",
    sessionId: "test-1",
  }),
}).then((r) => r.json()).then(console.log);
```

---

## Notas

- **Redeploy:** si editás `Code.gs`, Implementar → **Administrar implementaciones** → lápiz → Nueva versión → Guardar. La URL `/exec` suele mantenerse.
- **Dedupe:** mismo `sessionId` + `q` → se **actualiza** la fila (no suma doble).
- **Privacidad:** es store temporal del evento; no es CRM. Exportá/limpiá después del congreso.
- **No** hace falta `git push` ni deploy Vercel para el backend.
