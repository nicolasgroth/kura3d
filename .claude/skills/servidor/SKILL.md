---
name: servidor
description: Levanta, detiene y verifica el servidor web de Kura3D y las corridas de Playwright sin dejar procesos colgados. Úsalo antes de abrir la app en el navegador, antes de lanzar QA o evaluación, al cerrar un lote y antes de cada mensaje de cierre al usuario.
---

# Servidor y procesos de Kura3D

El autor trabaja en otras cosas en la misma máquina. Un proceso de desarrollo que queda vivo le quita memoria y CPU a todo lo demás. En Windows, detener una tarea en segundo plano (`TaskStop`) cierra el `npx` que la lanzó, pero **deja vivo el `node` hijo**: Vite sigue escuchando y Playwright deja sus navegadores. Por eso todo cierre se hace por PID y se verifica.

## Reglas

1. **Un proceso pesado a la vez.** Servidor web + una sola de estas: corrida de Playwright, `npm test`, `npm run build`, un agente con navegador. Nunca dos agentes con navegador ni dos corridas de Playwright en paralelo.
2. **Un servidor, un puerto.** El servidor de QA y evaluación es el **5189**. Los agentes en worktree no levantan el suyo salvo que su encargo lo pida; en ese caso usan un puerto del rango 5290–5299 que el orquestador asigna y anota.
3. **Playwright nunca levanta su propio servidor si ya hay uno:** toda corrida lleva `KURA_URL=http://127.0.0.1:5189/` y `--workers=1`.
4. **Nadie mata lo que no lanzó**, salvo el orquestador al cerrar un lote. Los conectores `@playwright/mcp` y `server-pdf` son de la app de Claude: no se tocan.

## Ver qué hay vivo

```
powershell -NoProfile -File .claude/skills/servidor/procesos.ps1
```

Lista PID, puerto, hora de inicio y memoria de servidores Vite, corridas de Playwright, navegadores de prueba y vitest.

## Levantar

1. Corre el listado. Si el 5189 ya responde (`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5189/` da 200) y el proceso nació después del último cambio de rama, se reutiliza.
2. Si no, ciérralo (abajo) y levántalo en segundo plano:
   `npx vite --host 127.0.0.1 --port 5189 --strictPort`
   Agrega `--force` solo si cambió `package-lock.json` o la app carga módulos viejos.
3. Confirma que responde 200 antes de encargar nada.

Un servidor que lleva horas o que sirvió varias ramas se reinicia antes de una QA o una evaluación: se degrada y da fallos falsos.

## Detener

```
powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar
powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar -Conservar 5189
```

La primera forma cierra todo; la segunda deja el servidor de QA. El script termina cada árbol de procesos por PID y falla si queda un puerto abierto. Después de un `TaskStop` sobre un servidor o una corrida, corre siempre `-Cerrar`: el `TaskStop` solo no basta.

## Cuándo revisar

- Antes de lanzar un agente de QA o de evaluación.
- Cuando un agente entrega (sobre todo si se cortó por tope o por límite de uso).
- Al cerrar un lote y antes de cada mensaje de cierre al usuario: el listado debe decir «Limpio», o mostrar solo el servidor que se decidió dejar, y eso se le dice al usuario.

## En los encargos a agentes

Copia estas líneas en todo encargo que use navegador o Playwright:

> Un solo proceso pesado a la vez. Playwright siempre con `KURA_URL=http://127.0.0.1:<puerto>/` y `--workers=1`, nunca dos corridas a la vez. No levantes otro servidor. Al terminar, cierra el navegador y corre `powershell -NoProfile -File G:/proyectos/kura3d/.claude/skills/servidor/procesos.ps1`; si queda algo que tú lanzaste, ciérralo por PID y dilo en el informe.
