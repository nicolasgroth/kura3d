# Suavizar malla — motor

Estado: motor listo (`feat/suavizar-motor`), sin interfaz. Amplía la sección A2 de `AGREGADOS_Y_PREPARACION.md`.

## Qué hace

Quita facetado y ruido de un modelo importado o esculpido moviendo solo vértices: no remalla, no cambia la cantidad de vértices ni triángulos, no abre la malla y no agranda la caja envolvente. Algoritmo: **Taubin λ/μ** (Taubin 1995, *A signal processing approach to fair surface design*) con laplaciano uniforme sobre vértices soldados: en cada iteración un paso que suaviza (λ > 0) y otro que devuelve el volumen (μ < 0). Puede limitarse a una zona con atenuación.

Código:

| Archivo | Responsabilidad |
|---|---|
| `src/engine/smooth/smoothOptions.ts` | Rangos, valores por defecto, validación, λ/μ |
| `src/engine/smooth/smoothGraph.ts` | Grafo de vecinos (CSR), bloqueos y pesos de zona, armado una vez |
| `src/engine/smooth/taubin.ts` | Núcleo de iteraciones y tope a la caja original |
| `src/engine/smooth/smoothDamage.ts` | Triángulos invertidos y autointersecciones nuevas (BVH), con los vértices dañados |
| `src/engine/smooth/smoothGuard.ts` | Protección local ante daño: máscara de amortiguación por anillos y cobertura de intensidad |
| `src/engine/smooth/smoothMesh.ts` | `smoothMesh(mesh, opciones)`: orquesta, protege, reintenta y mide |
| `src/core/operations/smoothOperations.ts` | `smoothObject`: `SceneChange` de un parche (un paso de deshacer) |
| `engineTasks.ts` → `smooth` | Tarea del Worker (buffers transferibles, progreso `smooth:i/n`, `smooth:check`) |

## Parámetros y valores por defecto

| Opción | Rango | Por defecto | Por qué |
|---|---|---|---|
| `iterations` | 1–100 (entero) | 10 | Basta para quitar facetado y ruido fino sin aplanar detalles; 30+ empieza a inflar levemente (+0,5 % de volumen en una esfera con ruido). |
| `strength` | 0,1–1 | 1 | λ = 0,5·fuerza. λ 0,5 es el valor de Taubin; con λ ≤ 0,5 y kPB = 0,1 la respuesta \|f(k)\| ≤ 1 en todo el espectro del laplaciano uniforme (k ∈ [0, 2]), así que nunca amplifica ruido. μ = 1/(kPB − 1/λ) = −0,526 con fuerza 1. |
| `preserveSharpEdges` | sí/no | sí | Las piezas para imprimir tienen aristas funcionales. |
| `sharpAngleDeg` | 1–180 | 40° | Protege chaflanes de 45° y aristas de 90°. El diseño previo proponía 60°, pero 60° redondea chaflanes de 45°. Ver límites: en mallas con mucho ruido conviene subirlo o desactivarlo. |
| `preserveBoundary` | sí/no | sí | En mallas abiertas el borde se encoge con cualquier laplaciano. |
| `zone.triangles` / `zone.vertices` | índices | toda la malla | Máscara. `trianglesWithColor(mesh, color)` convierte una zona pintada (`faceColors`) en triángulos. |
| `zone.falloffRings` | 0–10 | 2 | Peso 1 dentro, 1 − r/(R+1) en el anillo r, 0 más allá: la transición no deja escalón. Los anillos quedan **fuera** de los triángulos de la zona (por diseño): con R = 2 se mueven también los vértices a 1 y 2 aristas del borde (los 37 vértices, máx. 0,09 mm, que un evaluador vio moverse fuera de una zona x > 0 con R = 2 son esos anillos); más allá, nada (`smoothZoneFalloff.test.ts`). |
| `onDamage` | `reduce` / `error` | `reduce` | Ver garantías. |
| `scale` | [sx, sy, sz] ≠ 0 | [1, 1, 1] | Escala del objeto (`smoothObject` pasa `obj.scale`). La malla se suaviza en local (el laplaciano uniforme es lineal: L(S·x) = S·L(x), así que da lo mismo), pero el ángulo de arista viva (normal de mundo = S⁻¹·n), el volumen (× \|sx·sy·sz\|) y el desplazamiento se miden en mundo. La rotación no cambia ángulos ni volúmenes. |

Los rangos viven en `SMOOTH_RANGES` (no en `OPERATION_RANGES`): al sumarlos ahí, la prueba de paridad exige el esquema MCP y el de IA, que quedan para el lote de MCP.

## Garantías (con pruebas de motor real)

- **Topología intacta:** mismos índices y cantidad de vértices. Las costuras sin soldar (sopa de triángulos) se sueldan por posición (1e-4 mm, la adyacencia de la pintura) y los duplicados se mueven juntos. La malla sigue cerrada (`isClosedMesh`) y Manifold la acepta.
- **Volumen** (medido, valores por defecto): esfera UV facetada 48×24, +0,63 %; esfera con ruido ±8 % de la arista, +0,17 %; esferas regulares de 50 mil y 250 mil triángulos con ruido, +0,02 % y +0,005 %; cubo refinado, 0 %. Con 50 iteraciones sigue bajo 2 %. Sobre 2 % se avisa `SMOOTH_VOLUME_CHANGED`.
- **Caja envolvente:** nunca crece (cada vértice se acota a la caja original; el leve inflado de Taubin en las frecuencias más bajas queda recortado).
- **Aristas vivas y bordes protegidos:** sus vértices no se mueven, ni un bit. Las caras planas del cubo siguen planas.
- **Zona:** fuera de la zona y sus R anillos nada se mueve; el desplazamiento medio en la transición es menor que dentro. Una zona por color sin ese color pintado (o sin color elegido) es un error `invalid-params` (`smoothTaskOptions`, `parseSmoothMesh`), igual que `falloffRings` sin `zoneColor` en el bus y el MCP; antes suavizaba la pieza entera sin avisar.
- **Daño:** tras suavizar se cuentan triángulos invertidos o colapsados (la normal gira 90° o más, o el área cae bajo 1e-4 de la original) y autointersecciones nuevas (pares sin vértices comunes que se cortan después y no antes; un solo `bvhcast` de la BVH contra sí misma, con prefiltro de cajas). Con `onDamage: 'error'` el primer daño falla con `SMOOTH_DAMAGE` (traducido en 6 idiomas) y la escena no cambia.
- **Protección local ante daño** (`onDamage: 'reduce'`, por defecto; `smoothGuard.ts`): los vértices de los triángulos dañados quedan fijos (amortiguación 0) y sus 2 anillos de vecinos amortiguados (1/3 y 2/3), y se vuelve a suavizar con la fuerza pedida. Se repite hasta 8 rondas. Cada ronda solo revisa los triángulos que cambiaron respecto de la anterior (los que no cambiaron conservan su estado; los dañados vuelven exactamente a su posición original porque sus vértices quedan con peso 0): con pocos cambiados, un `shapecast` por triángulo en vez del recorrido propio completo. Solo si los protegidos pasan del 20 % de los vértices movibles (el daño no es local) o se agotan las rondas, la fuerza global baja a la mitad (conservando la máscara) hasta 3 veces y se avisa `SMOOTH_STRENGTH_REDUCED`; si sigue, `SMOOTH_DAMAGE`. El informe trae `damageProtectedVertices`, `movableVertices` y `strengthCoverage` (fracción de los movibles con intensidad efectiva global·amortiguación ≥ 80 % de la pedida). Algoritmo: enmascarado de vértices por vecindad en el grafo (BFS), determinista; es la «restricción de vértices» habitual de los suavizados con bloqueo (como los vértices fijos de las aristas vivas), aplicada solo donde hubo daño. Pliegue en V de pared 0,3 mm sin proteger aristas y 60 iteraciones: antes fuerza 1 → 7 invertidos, 0,5 → 3, 0,25 → 0 (se entregaba 0,25 para toda la pieza); ahora se entrega fuerza 1 con una parte del pliegue protegida. Con ruido de ±1,5 mm repartido por una esfera, la protección supera el 20 % y se recurre a la fuerza global (0,25).
- Sin vértices que mover (zona vacía o todo protegido): aviso `SMOOTH_NO_EFFECT` y cambio sin parches.

## Rendimiento (10 iteraciones + control de daño, Node, equipo con otros procesos)

| Malla | Total | Grafo | Taubin ×10 | Daño |
|---|---|---|---|---|
| ~50 mil tri | 0,5–0,8 s | 0,15–0,45 s | 0,03–0,4 s | 0,4–1,4 s |
| ~250 mil tri | 3,1–10 s | 0,8–2,2 s | 0,07–0,4 s | 1,9–3,8 s |

Las mediciones varían mucho por la carga de la máquina. El control de daño domina; Taubin en sí es lineal y barato. Umbrales de `smoothMesh.perf.test.ts`: 3 s y 15 s.

### Modelos reales (intensidad 0,5, 5 pasadas, aristas vivas a 40°)

`smoothRealModels.perf.test.ts` lee `.eval-tmp/modelos/` (modelos de terceros que no se versionan; se omite si no existe). Criterio: intensidad efectiva ≥ 0,4 en al menos el 95 % de los vértices movibles, cerrada, misma topología, volumen ±0,5 %, sin daño nuevo.

| Modelo | Antes | Ahora: global / cobertura | Protegidos por daño | Despl. máx | Volumen | Tiempo antes → ahora |
|---|---|---|---|---|---|---|
| Ocarina (38 mil tri) | rechazado `SMOOTH_DAMAGE` | 0,5 / 97,4 % | 405 de 15 756 | 2,66 mm | +0,022 % | 0,8 s → 0,5 s |
| Tinker (183 mil) | 0,0625 en toda la pieza | 0,5 / 98,7 % | 701 de 53 830 | 5,14 mm | −0,035 % | 3,8 s → 1,4 s |
| Spiral Phoenix (253 mil) | 0,25 en toda la pieza | 0,5 / 99,97 % | 33 de 124 843 | 0,59 mm | +0,003 % | 2,4 s → 1,6 s |

El desplazamiento máximo es sobre todo tangencial (deriva del laplaciano uniforme en triángulos muy alargados): en la dirección de la normal, el máximo es 0,76 / 0,38 / 0,03 mm y el percentil 99,9 0,15 / 0,14 / 0,01 mm.

## Librerías evaluadas

- **Manifold `smoothOut` / `smoothByNormals`** (Apache-2.0, ya instalada): suaviza con tangentes y exige `refineToLength`, así que cambia la topología y la cantidad de triángulos. Sirve para «Refinar», no para esto.
- **three.js** (MIT, ya instalada): no trae Taubin ni suavizado laplaciano de malla.
- **meshoptimizer** (MIT, no instalada): simplificación y orden de vértices; no suaviza.
- **`taubin-smooth`** (npm, MIT, mikolalysenko): Taubin sobre listas de celdas, sin protección de aristas ni zona ni detección de daño, y sin mantenimiento desde hace años. No vale la dependencia para ~60 líneas de núcleo.
- **three-mesh-bvh** (MIT, ya instalada): **sí**, para la detección de autointersecciones.
- **Adyacencia propia** (`src/engine/paint/faceAdjacency.ts`): **sí**, se reutiliza (soldadura, aristas, normales).
- **Protección local**: no hay librería JS permisiva que la traiga (libigl es MPL-2.0 pero C++; CGAL es GPL, prohibida; MeshLab/vcglib GPL). Es un BFS sobre el CSR que ya existe (~90 líneas en `smoothGuard.ts`): no vale una dependencia.

## Límites conocidos

- Laplaciano uniforme: además de suavizar, reparte los vértices (deriva tangencial). En mallas muy anisótropas (polos de una esfera UV densa con ruido, modelos reales con triángulos largos) eso invierte triángulos alargados; el control lo detecta y protege esos vértices. La deriva explica desplazamientos máximos de varios mm en Tinker y Ocarina aunque la forma cambie mucho menos (ver tabla); proyectar el desplazamiento sobre la normal la quitaría, a costa de suavizar menos el facetado.
- La protección local no avisa con un código propio: la interfaz y el MCP lo ven en `damageProtectedVertices` y `strengthCoverage`. Mostrarlo en el panel queda para un lote de interfaz.
- Los vértices protegidos por daño conservan su ruido (como las aristas vivas): en Ocarina, 405 vértices (2,6 %). Un laplaciano de cotangentes evitaría la deriva, con más costo y riesgo numérico en triángulos degenerados.
- La protección de aristas usa solo el diedro: en un escaneo con ruido fuerte (ruido de ±23 % de la arista) el 40 % de los vértices queda fijo como «arista viva» y el ruido baja poco. Para esos modelos la interfaz debe ofrecer subir el umbral o desactivar la protección.
- Las aristas vivas se fijan; no se suavizan a lo largo de la línea de la arista (una arista vertical con ruido sigue ruidosa).
- El control de autointersección omite pares que comparten un vértice (un pliegue sobre un mismo vértice lo detecta el control de invertidos).
- Taubin no recupera detalle ni redondea aristas con radio definido (eso es «Redondear aristas», lote posterior). Una malla muy gruesa necesita «Refinar» antes.
- Soldar con `faceAdjacency` usa claves de texto: es la fase más lenta del grafo en 250 mil triángulos.

## Qué necesitará la interfaz

- Campos: iteraciones (1–100), fuerza (10–100 %), «Proteger aristas vivas» con su ángulo (40° por defecto), «Proteger bordes abiertos» (solo si la malla no es cerrada), zona: «Todo el objeto» o «Zona pintada» (color elegido + anillos de transición 0–10).
- Vista previa: correr la tarea `smooth` en el Worker con `onProgress` (`smooth:i/n`, `smooth:check`) y mostrar la malla resultante sin aplicarla; aplicar usa el mismo `SceneChange` (un paso de deshacer). Mostrar el informe: fuerza aplicada, vértices movidos y fijos, cambio de volumen y desplazamiento máximo.
- Zona pintada: `trianglesWithColor(obj.mesh, color)` → `zone.triangles`; el pincel y el relleno de `src/engine/paint/` ya existen.
- Mensajes: `SMOOTH_STRENGTH_REDUCED`, `SMOOTH_VOLUME_CHANGED`, `SMOOTH_NO_EFFECT` y el error `SMOOTH_DAMAGE` ya traducidos.
- Pendiente fuera de este lote: catálogo de acciones, comando del bus, herramienta MCP `kura_smooth_mesh` (mover `SMOOTH_RANGES` a `OPERATION_RANGES` con su paridad) y guía en `docs/guia/`.
