# Landing — Congreso Capital Humano e IA

Skeleton de deck **horizontal** para proyector (John Galt).  
Marca: [johngalt.ar](https://johngalt.ar). Fecha: **8 octubre 2026**.

**15 slides**, todas visibles (filtro operador pausado para share con Elio). Cada slide es viewport completo.

## Abrir en local

Opción A — archivo directo:

```
file:///D:/2026/congreso-ia/landing/index.html
```

Mejor con servidor estático (video + localStorage):

```powershell
cd D:\2026\congreso-ia\landing
npx --yes serve .
# o: python -m http.server 5500
```

Páginas:

- `/` — deck
- `/voto/?q=a` · `/voto/?q=b` — voto local (localStorage)
- `/voto/?q=a&view=tally` — tallies solo lectura
- `/invitados/` — stub

## Las 15 slides (orden Gui)

1. **Welcome** — Bienvenidos; UNLaM; 8/10/2026
2. **Video Elio** — `assets/elio-intro.mp4`
3. **Diálogo Elio ↔ Gui** — tabs Opción 1/2/3
4. **QR ChatGPT** — número 1–30
5. **17** — ¿Cuántos sacaron 17?
6. **Claude** — challenge 23
7. **Cierre JG** — «John Galt desaparece hasta la próxima interrupción»
8. **Video Bilinkis** — `assets/bilinkis.mp4` (IA y trabajo)
9. **Truco CV · Regla** — misma pregunta, dos fichas
10. **Perfil A** — Valentina Morales (UBA · Big Four)
11. **Voto A** — SÍ/NO + `/voto/?q=a`
12. **Perfil B** — Brian Gómez (otra señal · PyME)
13. **Voto B** — SÍ/NO + `/voto/?q=b`
14. **Revelación** — misma persona / distinta señal
15. **Frase** — «El sesgo no lo inventa la IA. Lo escala.»

## Voto local

Clave `localStorage["congreso-voto-v1"]`. Mismo store entre deck (slides 11/13) y `/voto/`.

## Assets de video

- `assets/elio-intro.mp4` — Veo v1 take 01
- `assets/bilinkis.mp4` — clip Bilinkis (IA y trabajo)

`js/deck.js` pausa **todos** los `<video>` al cambiar de slide.

## Modo local vs público (PAUSADO)

Filtro `data-role="operator"` pausado. Badge: `TODAS · filtro pausado`.

## Vercel

Root = `landing/`. No desplegar desde este cambio salvo pedido (videos en assets).

## Estructura

```
landing/
  index.html
  vercel.json
  README.md
  css/brand-tokens.css
  css/landing.css
  js/deck.js
  js/voto.js
  assets/logo.svg
  assets/qr-chatgpt.svg
  assets/qr-claude.svg
  assets/elio-intro.mp4
  assets/bilinkis.mp4
  voto/index.html
  invitados/index.html
```
