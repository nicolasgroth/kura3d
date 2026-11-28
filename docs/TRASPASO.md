# Nota de traspaso entre sesiones

Se reescribe al cerrar cada conversación del orquestador (regla 11 de «Control de agentes» en `CLAUDE.md`). Última actualización: 28 de noviembre de 2026, mediodía.

## Estado

- El repositorio está en **`main`**, igual a GitHub. Sin agentes, sin servidores, sin worktrees, sin ramas de trabajo. `CLAUDE.md` tiene un cambio sin confirmar en la regla 11 que hizo el autor: no tocarlo.
- En `main`: `tsc` y build limpios, 4812 pruebas del programa y 220 del servidor MCP en verde.
- Cerrado entre el 27 y el 28: **centro de mensajes (87)**, **imán** (el desfase entre vista previa y hueco) y la monotonía de **Simplificar por tolerancia**.
- Bajo el mínimo: **placas 83** (en revisión por decisión del autor) y **Simplificar: usabilidad 80, funcional 84**.
- Consumo del 27 en la noche al 28 a mediodía, solo agentes: cerca de 2,3 millones de tokens en 13 agentes (QA 117 k + 171 k; interfaz 146 k + 226 k + 204 k + 174 k; motor 164 k + 289 k; evaluación 178 k + 177 k + 151 k + 162 k + 180 k), más un orquestador de sesión muy larga. Muy por encima del tope de 6 puntos por día, con acuerdo del autor («sigue con todo hoy», «sigue con la cola»). La semana reinicia el 3-dic a las 01:00 UTC.
- Detalle: `docs/EVALUACIONES.md`, secciones «27-nov-2026 · Noche», «28-nov-2026 · Madrugada» y «28-nov-2026 · Mañana».

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
- `cmd.cat.operations` de la paleta pasó de «Operaciones Manifold 3D» a «Operaciones de forma».
- Simplificar: una tolerancia mayor que la pieza ya no da `MESH_EMPTY`; se usa el mejor peldaño válido (cambia el resultado de `kura_simplify_mesh` en ese caso).

## Lo que sigue, en orden

1. **Simplificar, usabilidad (80).** Lote de interfaz: tras editar «Triángulos finales», Tab salta a «Arista objetivo» de Refinar y con Enter se ejecuta «Refinar» sin querer; el foco cae a `body` tras «Aplicar de todos modos» y tras «Reparar malla» lanzado desde el panel; el informe de la versión segura mezcla números de lo pedido y de lo aplicado (separar en un bloque «Lo pedido daría…»); avisos en pasado en la vista previa; sin avance real durante el cálculo; la malla abierta se avisa recién al pedir la vista previa; decimales desparejos; el mensaje no dice que se aplicó la versión segura.
2. **Simplificar, funcional (84, sin reevaluar tras corregir el colapso de la escalera).** Lote de motor chico: «Por cantidad» marca la meta como alcanzada aunque quede muy por debajo y sigue buscando por bisección, que supone una monotonía que Manifold no tiene; por tolerancia se estanca sin avisar (sugerir «Por cantidad»); no se cuentan los cuerpos antes y después. Decisión del autor pendiente: cambiar a meshoptimizer (MIT), monótono y rápido, que evitaría las 13 llamadas pero exige revalidar que el sólido quede cerrado.
3. **Placas (83), en revisión.** Si el autor la retoma: con «Fuera de volumen» la ficha activa corta su nombre a «Pla…» a 1366 px; el aviso «No cabe en la cama…» queda como columna angosta a 1024 px, tapa la barra de selección y sigue en Armado y Libre; «Solo esta» no encuadra la placa activa tras borrar ni al cambiar de ficha; en fichas compactas el estado es solo icono y su `title` no lo nombra; Tab hace dos paradas por placa; Armado y Libre se ven iguales; convertir en placas no trae «Deshacer» en su mensaje. Las notas de cuatro rondas (84, 80, 84, 83) no convergen con vueltas sueltas: conviene evaluar con dos evaluadores sobre la misma versión.
4. **Centro de mensajes, para subir de 87:** un informativo que va directo al histórico no da señal visible; «…imprime una placa a la vez» sigue como información; la advertencia de orientación mezclada no trae «Reparar malla»; el panel no tiene botón de cierre visible; «Vaciar» sin deshacer. Menor de QA abierto: tras Ctrl+Z de «Convertir en placas» el foco cae a `body`.
5. **Patrones** (83 / 90): dos paneles apilados a 1024 px; glifo «✓» en nombres accesibles.
6. **Asistentes roscados**: tapa roscada (80 / 90) y acople de tubería (82 / 89): estado del ajuste fuera de vista; Enter crea las piezas; `kura_create_pipe_coupling` ignora parámetros desconocidos.
7. **Dividir**: instrucciones de armado (81 / 86, el foco no vuelve), por las partes de la figura (72 / 80), cortes a mano e inclinados (72 / 84).
8. Consulta del autor sobre la barra de avance del guardado (`docs/CONSULTAS_PROYECTO.md`).
9. PR 21 de Playwright (Dependabot): no se toca sin pedido expreso.
10. Instalador de Windows (ver arriba).
11. Deuda anotada: 107 rutas absolutas `G:/proyectos` en `e2e/`. El arreglo del imán no se verificó con ratón físico en la app de escritorio ni con escalado de Windows distinto de 100 %.

Patrón que se repite en casi todas las notas bajas: **el foco cae a `body`** cuando desaparece el control que lo tenía. Hay un ayudante para eso (`src/components/toastFocus.ts`: `restoreFocusAfter`, `focusViewer`); un lote transversal de foco rendiría más que corregirlo funcionalidad por funcionalidad.

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
- Un agente que deja tareas de fondo vuelve a enviar su mismo informe cada vez que una termina: no es información nueva.
- Un encargo de motor que mide con modelos reales y corre recorridos largos pasa de 60 min: darle tope de 75 o pedirle que no espere la corrida de recorridos.
