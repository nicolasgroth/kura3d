---
name: capturas
description: Regenera las capturas y animaciones de las guías públicas de Kurra Studio desde la app web y comprueba los enlaces. Úsalo cuando un lote cambia algo que el usuario ve (interfaz, textos, menús) y antes de fusionar ese lote a main.
---

# Capturas de las guías

Regla 9 de `CLAUDE.md`: las guías de `docs/guia/` se actualizan en el mismo lote que cambia lo que el usuario ve, y sus imágenes se generan desde la app, nunca a mano. Una captura que no coincide con la interfaz es un fallo de QA.

## Pasos

1. **Procesos.** Sigue la skill `servidor`: nada más pesado corriendo. Si el servidor 5189 está arriba y sirve la rama que vas a documentar, reutilízalo.
2. **Generar.**
   - Con el servidor 5189 arriba: `KURA_URL=http://127.0.0.1:5189/ npm run docs:capturas`
   - Sin servidor: `npm run docs:capturas` (levanta uno propio en el 5239 y lo cierra al terminar; verifica después con el listado de la skill `servidor`).
   Corre los 17 recorridos de `e2e/docs/` con un solo worker; tarda unos 5 minutos.
3. **Si un recorrido falla**, casi siempre es porque la interfaz cambió (un botón que se movió a un submenú, un rótulo nuevo). Corrige el recorrido en `e2e/docs/` usando los ayudantes (`e2e/agregar-helpers.ts`, `e2e/acciones-helpers.ts`, `e2e/store-link.ts`), no fijando coordenadas. Vuelve a correr solo ese archivo: `npx playwright test -c playwright.docs.config.ts e2e/docs/<archivo>`.
4. **Mirar.** Abre con `Read` las imágenes de las guías cuya funcionalidad cambió y confirma que muestran lo que el texto describe: panel correcto abierto, sin avisos tapando, sin estado de carga. Generar no es verificar.
5. **Texto.** Revisa que los nombres de botones y menús en `docs/guia/*.md` y `README.md` coincidan con la interfaz actual (`git diff main -- src/i18n` muestra los rótulos que cambiaron). Si cambió una herramienta `kura_*`: `npm run docs:mcp` y revisa `docs/MCP.md`.
6. **Enlaces.** `npm run docs:enlaces` debe decir 0 enlaces rotos y 0 imágenes sin usar.
7. **Commit** de `docs/guia/` y de los recorridos corregidos, en el mismo lote.

## Qué informar

Cuántos recorridos pasaron, qué guías cambiaron de imagen o de texto, y cualquier captura que no pudiste verificar a ojo.
