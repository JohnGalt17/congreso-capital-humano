# Landing — Congreso Capital Humano e IA

Skeleton de deck **horizontal** para proyector (John Galt).  
Marca: [johngalt.ar](https://johngalt.ar). Fecha: **8 octubre 2026**.

**7 slides**, todas visibles (filtro operador pausado para share con Elio). Cada slide es viewport completo.

## Abrir en local

Opción A — archivo directo:

```
file:///D:/2026/congreso-ia/landing/index.html
```

`file://` / localhost / Vercel: se ven las **7 slides** (filtro mode pausado temporalmente).

Opción B — servidor estático:

```powershell
cd D:\2026\congreso-ia\landing
npx --yes serve .
# o: python -m http.server 5500
```

Stubs:

- `http://localhost:xxxx/voto/`
- `http://localhost:xxxx/invitados/`

## Modo local vs público (PAUSADO)

`js/deck.js` **ya no filtra** slides `data-role="operator"`. Todas se muestran siempre (Vercel y local).

Gui reactivará el filtro public/private más adelante. El código de detección `MODE_LOCAL` queda comentado / sin efecto de hide.

Badge UI: `TODAS · filtro pausado`.

## Las 7 slides

1. **Welcome** (public) — Bienvenidos; UNLaM · Económicas; 8/10/2026; lema coloquio; footer académico
2. **Introducción de Elio** — placeholder segmento host
3. **Diálogo Elio ↔ Gui** — 3 opciones con tabs (Opción 1/2/3) en la misma slide
4. **QR ChatGPT** — `https://chatgpt.com/` + «Decime un número entre el 1 y el 30»
5. **17** — «¿Cuántos sacaron 17?»
6. **Claude** — QR `https://claude.ai/` + challenge 23
7. **Cierre** — «John Galt desaparece hasta la próxima interrupción»

## Vercel (estático)

1. Root = carpeta `landing/`
2. Framework: Other / static
3. `vercel.json` rewrites `/voto` y `/invitados`

## Estructura

```
landing/
  index.html          # deck (7 slides, todas visibles)
  vercel.json
  README.md
  css/
    brand-tokens.css  # lightness 30, gold + cyan
    landing.css       # deck + stubs + tabs/welcome
  js/
    deck.js           # nav + tabs; filtro operador PAUSADO
  assets/
    logo.svg
    qr-chatgpt.svg    # segno → chatgpt.com
    qr-claude.svg     # segno → claude.ai
  voto/index.html
  invitados/index.html
```

## Tokens

- Fondos LCH (`--lightness: 30`), cards, texto
- Acentos: cyan `--overlay-color #00aeef` + oro logo
- Fuentes: Outfit (display UPPERCASE), DM Sans, IBM Plex Mono

## QR

SVG locales con [segno](https://pypi.org/project/segno/) (3-H, border 4). Funcionan en `file://` sin red.

```powershell
python -c "import segno; segno.make('https://chatgpt.com/', error='H').save('assets/qr-chatgpt.svg', scale=10, dark='#111111', light='#ffffff', border=4)"
python -c "import segno; segno.make('https://claude.ai/', error='H').save('assets/qr-claude.svg', scale=10, dark='#111111', light='#ffffff', border=4)"
```
