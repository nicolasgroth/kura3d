# Nota de traspaso entre sesiones

Se reescribe al cerrar cada conversación del orquestador (regla 11 de «Control de agentes» en `CLAUDE.md`). Última actualización: 28 de noviembre de 2026, madrugada.

## Estado

- El repositorio está en **`main`**, igual a GitHub. Quedaron fusionados y subidos el centro de mensajes (27-nov) y el lote de usabilidad de mensajes y placas (28-nov, madrugada). Sin agentes, sin servidores, sin worktrees, sin ramas de trabajo.
- En `main`: `tsc` y build limpios, 4802 pruebas del programa y 220 del servidor MCP en verde.
- **Centro de mensajes: 87 en usabilidad, cerrado.** **Placas: 83, sigue bajo el mínimo** tras cuatro rondas en dos días (84, 80, 84, 83).
- Consumo de la noche del 27 y la madrugada del 28: QA 117 k + 171 k; desarrollo 146 k + 226 k + 204 k + 174 k; evaluación 178 k + 177 k + 151 k; más un orquestador de sesión muy larga. Se pasó con holgura el tope de 6 puntos por día, con acuerdo del autor («sigue con todo hoy»). La semana reinicia el 3-dic a las 01:00 UTC.
- Detalle: `docs/EVALUACIONES.md`, secciones «27-nov-2026 · Noche» y «28-nov-2026 · Madrugada».

## Acordado con el autor

- Cerrar todo lo abierto antes de cualquier funcionalidad nueva; una funcionalidad a la vez.
- Diseño breve aprobado por él antes de programar, en los lotes que cambian comportamiento.
- Lista de comprobación de usabilidad en cada encargo: foco que vuelve, estado junto al botón de acción, Enter no crea ni destruye, nombres accesibles sin glifos, coma decimal, un solo panel lateral a 1024 px.
- Presupuesto: tope de 6 puntos de la semana por día y máximo 2 agentes a la vez. Si el plan del día termina antes, se le avisa y se sigue con lo siguiente de la cola.
- Análisis de impacto y pruebas afectadas en cada encargo (regla 10). La suite completa de recorridos solo al cierre de versión.
- Centro de mensajes: los iconos se quedan en el pie del visor junto a «Cama:». Aprobó que un mensaje con acción vigente no caduque ni lo desplace un informativo, y que un informativo tampoco desplace a un error o advertencia.
- Los cambios van a `main` y se suben a GitHub por push directo (la protección de `main` no aplica al administrador).
- **Instalador de Windows:** el autor quiere generarlo y probar la app instalada cuando termine el cierre, si alcanza la semana. Es trabajo nuevo: va después de lo abierto.

## Decisiones que tomó el orquestador y el autor aún no revisó

Se tomaron la madrugada del 28 para no frenar; todas se pueden revertir:

- Pasaron a advertencia los avisos del motor que piden actuar (lista en `src/store/engineWarningKind.ts`) y «No había espacio libre en la cama». Dudosos: `MESH_WELDED_IMPLICITLY` y `HOLLOW_SELF_INTERSECTING`.
- Tras reparar una malla con un agujero grande queda a la vista la advertencia «Se cerró 1 agujero grande…» y «Malla reparada» va al histórico.
- El emergente crece hasta 480 px (antes 300 fijos).
- Una advertencia sin botón no desplaza a un emergente con acción vigente no transitoria.
- Con un diálogo abierto y sin sitio libre, un error o advertencia se dibuja sobre el velo aunque pise una esquina del diálogo; un informativo queda detrás.
- Las placas creadas al convertir un 3MF se numeran seguidas y no heredan el número del laminador.
- «Repartir» y «Convertir grupos en placas» pasaron a la categoría «Placas» de la paleta.
- Enter con el foco en un botón ya no entra a un grupo.

## Lo que sigue, en orden

1. **Decisión del autor sobre placas (83).** Regla 6: lleva diez rondas bajo el mínimo y cada evaluador nuevo da por corregido lo anterior y descuenta cosas distintas, así que las vueltas sueltas no convergen. Opciones a proponerle: (a) un lote más con lo de la última ronda y una evaluación con dos evaluadores en paralelo sobre la misma versión, para medir cuánto varía la nota; (b) aceptar placas como «en revisión» y seguir con la cola. Lo que restó la última ronda: con «Fuera de volumen» la ficha activa corta su nombre a «Pla…» a 1366 px; el aviso «No cabe en la cama…» queda como columna angosta a 1024 px, tapa la barra de selección y sigue en Armado y Libre; «Solo esta» no encuadra la placa activa tras borrar ni al cambiar de ficha; en fichas compactas el estado es solo icono y su `title` no lo nombra; Tab hace dos paradas por placa; Armado y Libre se ven iguales; convertir en placas no trae «Deshacer» en su mensaje.
2. **Centro de mensajes, para subir de 87:** un informativo que va directo al histórico no da señal visible; «…imprime una placa a la vez» sigue como información; la advertencia de orientación mezclada no trae «Reparar malla»; el panel no tiene botón de cierre visible; «Vaciar» sin deshacer. Menor de QA abierto: tras Ctrl+Z de «Convertir en placas» el foco cae a `body`.
3. **Imán** (`qa24-iman:178` y `:721`): la boca del hueco queda a 0,23 y 0,40 mm del punto de la vista previa. Lote de motor; sin causa todavía.
4. **Simplificar** (82): Por tolerancia no es monótono (motor), texto de la versión segura, categoría en la paleta. Lote de motor chico; reevaluar después.
5. **Patrones** (83 / 90): dos paneles apilados a 1024 px; glifo «✓» en nombres accesibles.
6. **Asistentes roscados**: tapa roscada (80 / 90) y acople de tubería (82 / 89): estado del ajuste fuera de vista; Enter crea las piezas; `kura_create_pipe_coupling` ignora parámetros desconocidos.
7. **Dividir**: instrucciones de armado (81 / 86, el foco no vuelve), por las partes de la figura (72 / 80), cortes a mano e inclinados (72 / 84).
8. Consulta del autor sobre la barra de avance del guardado (`docs/CONSULTAS_PROYECTO.md`).
9. PR 21 de Playwright (Dependabot): no se toca sin pedido expreso.
10. Instalador de Windows (ver arriba).
11. Deuda anotada: 107 rutas absolutas `G:/proyectos` en `e2e/`.

## Datos prácticos

- Servidor web solo desde el directorio principal: `npx vite --host 127.0.0.1 --port 5189 --strictPort`. Recorridos: `KURA_URL=http://127.0.0.1:5189/ npx playwright test --workers=1 <archivo>`. Cierre: `powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar`. Un solo proceso con navegador a la vez. Reiniciar el servidor al cambiar de rama.
- Los 45 archivos de `e2e/` que usan avisos o placas tardan 1,9 h (365 casos); la lista está en `.eval-tmp/agentes/e2e-cierre-lista.txt`. Una corrida en segundo plano de esa duración termina bien y avisa sola.
- Evaluar antes de la corrida larga de recorridos ahorra tiempo: las notas llegan en 10 min y los recorridos se corren una sola vez sobre el código final.
- Un agente cortado por «token vencido» (401) se reanuda con un mensaje al mismo agente: su trabajo queda intacto en el directorio.
- `npm run docs:capturas` son 42 casos y tarda 11 a 15 min (más que el tope de 10 min de una orden en primer plano: lanzarlo en segundo plano).
- En `e2e/docs/`, el ayudante `captura()` cierra los mensajes antes de la foto; para fotografiar un mensaje se usa `page.screenshot` directo (ver `capturas-mensajes.spec.ts`).
- Los archivos de `e2e/` usan CRLF.
- Un worktree con `node_modules` enlazado no sirve para correr recorridos (403 al cargar el WASM). Con un solo lote en curso, el agente trabaja directo en el directorio principal, en su rama.
- `.eval-tmp/modelos` tiene modelos de terceros: solo lectura, no se copian al repositorio ni se borran.
- Recorridos inestables conocidos: cualquiera puede fallar al cargar con «`window.__s` no existe» (`qa23-arrastrar-asistentes`, `qa22-ajustes`, `qa24-iman:495`, `ux7-encuadre:51`, también en `main`); pasan al repetirlos. `qa22-ajustes:85` tarda unos 162 s con tope de 180 s.
- Referencia de costo: QA de un lote de interfaz 117 k en 3 min; correcciones de interfaz acotadas 146 k en 15 min; evaluación de usabilidad de dos funcionalidades 178 k en 7 min; lote de motor en Opus, 2 a 3 puntos de la semana.
- Un filtro `archivo:línea` de Playwright puede abarcar varias variantes de un caso.
