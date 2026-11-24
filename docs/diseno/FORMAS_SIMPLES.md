# Formas simples: reducir triángulos reconociendo primitivas — diseño

Estado: investigación (24-nov-2026), solo lectura; nada implementado ni decidido. Responde a la pregunta del autor: ¿se puede bajar el número de triángulos de un modelo reemplazando zonas por figuras más simples (planos, cilindros, esferas, conos, cajas), y con qué?

**Respuesta corta.** Sí, y en tres escalones muy distintos de costo. Lo plano es barato, exacto y casi todo existe ya en el repo. Los cilindros, esferas y conos se pueden reconocer con geometría clásica (sin IA y sin dependencia nueva), pero en mallas CAD **no bajan triángulos gratis**: una pared de cilindro con N segmentos ya usa el mínimo (2N); bajar N es perder precisión, igual que decimar. Lo que sí da reconocerlos es regenerarlos con los segmentos que uno elija, radios exactos, medir diámetros y limpiar escaneos. La conversión general de malla a CSG es investigación abierta y no se recomienda.

## 1. Qué hay hoy en el repo

Corrección al encargo: **Kura3D no usa meshoptimizer**. Figura como candidata en `docs/ROADMAP.md:57`, pero no está en `package.json`. La simplificación actual es de Manifold.

| Pieza | Ruta | Qué hace y para qué sirve aquí |
|---|---|---|
| Simplificar | `src/engine/analysis.ts:71` (`simplifyMesh`) | `Manifold.simplify(tol)`: el resultado usa un subconjunto de los vértices originales y ninguna superficie se mueve más que `tol`; sale cerrado. Rango 0,01–100 mm (`operationLimits.ts:92`), aviso si el volumen cambia más de 2 % (`:178`). Exige malla cerrada. |
| Caras coplanares de Manifold | `node_modules/manifold-3d/manifold.d.ts:1378` (`faceID`) | Si no se entregan `faceID`, Manifold los calcula con su propio criterio de coplanaridad, y `simplify` respeta las aristas entre caras distintas. Es decir: **Manifold ya agrupa caras planas**; lo que no garantiza es la triangulación mínima. |
| Triangulación de polígonos | `src/engine/repair/holeFill.ts` (`triangulateLoop`, `newellNormal`) | Proyecta un bucle a su plano y lo triangula con earcut (vía `THREE.ShapeUtils`, que acepta agujeros). Además `manifold-3d` exporta `triangulate()` (`manifold.d.ts:1624`). |
| Adyacencia de caras | `src/engine/paint/faceAdjacency.ts` (`getFaceAdjacency`) | Soldadura de vértices, aristas con sus triángulos y normal por cara, en arreglos planos y con caché por malla. Base directa del crecimiento de regiones. |
| Región suave desde una cara | `src/engine/measure/measureGeometry.ts:89` (`measureRegionArea`), `src/engine/paint/fill.ts` | Crecimiento de región por ángulo entre normales vecinas. Es el mismo recorrido que hace falta para "esta zona es un plano / un cilindro". |
| Estructuras | `src/engine/structuralSegmentation.ts` → `src/engine/segmentation/` | `adjacency.ts`: grafo de triángulos con pliegues y costuras cóncavas. `detection.ts`: regiones por costuras cóncavas y diedros (28° por defecto, máx. 12 regiones). `classification.ts`: arquetipos (`tank_cylinder`, `tube_conduit`, `dome_helmet`, `block_plate`…) con confianza **heurística**. `geometryUtils.ts:68`: ejes principales (PCA por Jacobi). Sirve de punto de partida, pero separa *partes* (brazo, tanque), no *superficies* (esta pared es un cilindro de radio 4): es más gruesa de lo que se necesita. |
| Topología y cierre | `src/engine/repair/meshTopology.ts` (`weldGrid`, `buildEdgeTable`, `isMeshClosed`), `boundaryEdges.ts` | Definición única de malla cerrada y bucles de borde. Es la validación obligada tras cualquier sustitución. |
| Uniones en T | `src/engine/tJunctions.ts` (`splitTJunctions`) | Cierra bordes cuando un lado quedó con vértices que el otro no tiene: el riesgo exacto de re-triangular una cara sin tocar a su vecina. |
| Distancia exacta | `src/engine/meshDistance.ts` (`buildMeshDistanceField`) | SDF exacto con BVH propio (mallas cerradas). Permite medir la desviación máxima (Hausdorff muestreado) entre original y resultado. |
| three-mesh-bvh 0.9 (MIT) | en uso en `paintPointer.ts` | `closestPointToGeometry` también sirve para medir desviación, incluso en mallas abiertas. |
| Casco convexo | `src/engine/analysis.ts:135` (`computeConvexHull`), `Manifold.hull` | Útil para probar "¿este cuerpo es convexo / es una caja?" comparando volumen de casco y de pieza. |
| Primitivas exactas | `src/engine/primitives.ts` (`createPrimitiveMesh`), `Manifold.cylinder/sphere/cube` | Generan la forma exacta, cerrada y con segmentos elegidos. |
| Curvatura | `Manifold.calculateCurvature` (`manifold.d.ts:842`) | Disponible en la librería; **el repo no la usa**. Curvatura gaussiana y media por vértice: distingue plano (0, 0), cilindro (gaussiana 0, media ≠ 0) y esfera (ambas constantes). |
| Refinar | `src/engine/refine.ts` | El camino inverso (subdividir manteniendo caras planas y aristas vivas); su verificación de dimensiones (`DIM_TOLERANCE_MM`) es el patrón a copiar. |

## 2. Enfoques conocidos

"CAD" = malla exportada de un programa paramétrico (caras planas y cilíndricas limpias). "Escaneo/esculpida" = superficie orgánica con ruido.

| Enfoque | Qué resuelve, en simple | Robustez CAD | Robustez escaneo/esculpida | Dificultad de hacerlo bien |
|---|---|---|---|---|
| **Fusión de caras coplanares + re-triangulación** | Junta triángulos vecinos que están en el mismo plano, se queda con el contorno del polígono (con agujeros), quita vértices colineales y lo triangula con el mínimo (n − 2 triángulos para n esquinas). Sin pérdida de forma. | Muy alta. Es donde más se gana: tapas, placas, textos extruidos, STL teselados de más. | Casi nula: no hay zonas planas exactas. | Baja-media. Lo delicado: quitar un vértice colineal solo si **todas** las caras que lo comparten lo permiten (si no, queda una unión en T y la malla se abre), y los triángulos casi degenerados. |
| **Crecimiento de regiones** (por normal o curvatura) | Parte de un triángulo y se expande mientras el vecino "se parece" (mismo plano, misma curvatura). Entrega parches candidatos a ser una primitiva. | Alta: las aristas vivas separan bien las caras. | Media-baja: depende del umbral; el ruido parte las regiones o las fusiona de más. | Baja (ya existe dos veces en el repo). Lo difícil es elegir umbrales que no dependan del tamaño de triángulo. |
| **Ajuste por mínimos cuadrados** | Dado un parche, calcula el plano, esfera, cilindro o cono que mejor calza, y el error. Plano y esfera son sistemas lineales (solución directa). Cilindro: eje = dirección en que las normales no varían (PCA de normales), luego un círculo en 2D. Cono: no lineal, necesita iterar (Gauss-Newton / Levenberg-Marquardt). | Alta para plano, esfera y cilindro; el cono es sensible al punto de partida. | Media: funciona si el parche está bien delimitado; un parche mal cortado da un ajuste "promedio" inútil. | Plano/esfera/cilindro: baja-media, unas cientos de líneas con pruebas. Cono y toro: media-alta. |
| **RANSAC de primitivas** (Schnabel, Wahl y Klein, 2007) | Prueba muchas primitivas a partir de pocos puntos al azar y se queda con las que más puntos explican. No necesita segmentar antes; pensado para nubes de puntos. | Alta, pero es más de lo necesario: en CAD el crecimiento de regiones da lo mismo de forma determinista. | La mejor de las clásicas ante ruido y datos incompletos. | Alta: muchos parámetros (ε, ángulo, tamaño mínimo), **resultado no determinista** (mala base para pruebas y para "mismo archivo, mismo resultado") y trabaja sobre puntos, no garantiza una malla cerrada. |
| **Variational Shape Approximation** (Cohen-Steiner, Alliez y Desbrun, 2004) | Reparte la malla en k parches planos (proxies) que minimizan el error y la reconstruye como poliedro de pocas caras. Da un "low-poly" de forma controlada. | Buena, pero en CAD la fusión coplanar es exacta y más simple. | Buena para un facetado estilizado; pierde detalle por diseño. | Alta: el particionado es abordable, la **extracción de la malla cerrada** entre parches es la parte frágil. Solo planos (hay extensiones a cuádricas, más difíciles). |
| **Descomposición convexa aproximada** (V-HACD, CoACD) | Parte un sólido en varios cuerpos casi convexos. | Funciona. | Funciona. | No se implementa, se usa una librería. **No reduce bien triángulos para imprimir**: es para colisiones físicas; cambia la forma (rellena concavidades) y deja juntas. |
| **Conversión a CSG / B-rep** (ingeniería inversa) | Reconstruir el modelo como operaciones entre primitivas (caja menos cilindro…), editable. | Posible en piezas prismáticas simples; se rompe con redondeos, superficies libres y roscas. | No aplica. | Muy alta; es tema de investigación vigente y de productos comerciales. Fuera de escala para Kura3D. |

Tres hechos que conviene tener claros antes de decidir:

1. **Decimar con tolerancia chica ya hace casi todo el trabajo plano.** `Manifold.simplify` colapsa aristas mientras la superficie no se mueva más que la tolerancia: en una zona plana eso es "gratis". No verifiqué con mediciones cuán cerca del mínimo queda; es lo primero que hay que medir (ver etapa 0).
2. **Un cilindro CAD ya está en su mínimo.** Una pared con N segmentos usa 2N triángulos. Solo sobra algo si trae anillos intermedios o tapas mal trianguladas. Bajar N es aceptar error de cuerda `r·(1 − cos(π/N))`: con r = 10 mm, 32 segmentos son 0,048 mm; 16 son 0,19 mm.
3. **Cambiar los segmentos de un cilindro obliga a rehacer a sus vecinos.** El borde del cilindro es también el borde de la tapa o de la cara donde está el agujero. Si se cambia de 64 a 24 lados, la cara vecina hay que re-triangularla con el contorno nuevo, o la malla queda abierta.

## 3. Librerías abiertas

| Librería | Qué aporta aquí | Licencia (verificada) | Navegador / WASM | Tamaño | Mantenimiento | Veredicto |
|---|---|---|---|---|---|---|
| **Manifold** (`manifold-3d` 3.5.5) | `simplify`, `faceID` coplanar, `triangulate`, `calculateCurvature`, `hull`, primitivas exactas | Apache-2.0 (`node_modules/manifold-3d/package.json`) | Ya integrado | `manifold.wasm` 543 KB (medido local) | Activo | **Base de todo. Sin costo.** |
| **three-mesh-bvh** 0.9 | Distancia entre mallas para validar | MIT (`package.json` local) | Ya integrado | — | Activo | Ya está. |
| **earcut** (vía `THREE.ShapeUtils`) | Triangular polígono con agujeros | ISC según la cabecera de `holeFill.ts`; no lo re-verifiqué en la web | Ya integrado | — | — | Ya está. |
| **meshoptimizer** (npm, 1.3) | Decimación rápida con error absoluto, bloqueo de bordes, `simplifySloppy`, `simplifyPrune` | MIT — https://github.com/zeux/meshoptimizer | Sí, el simplificador es WASM — https://cdn.jsdelivr.net/npm/meshoptimizer@1.3.0/README.md | No verificado (npm respondió 403); de memoria, decenas de KB | Activo | Viable, pero **no garantiza malla cerrada** y no detecta primitivas. Solo si Manifold resulta lento en mallas enormes o si hay que decimar mallas abiertas. |
| **CGAL** | Tiene justo lo pedido: Shape Detection (RANSAC y crecimiento de regiones), Surface Mesh Approximation (VSA), remallado planar en Polygon Mesh Processing | **GPL** en todos esos paquetes — https://doc.cgal.org/latest/Manual/packages.html ; núcleo LGPL, resto GPL — https://www.cgal.org/license.html | Habría que compilar | Grande | Activo | **Descartada** (GPL). Sirve solo como referencia de algoritmos; no se copia código. |
| **libigl** | Decimación, curvaturas principales, utilidades | MPL-2.0 en `include/igl`; la carpeta `copyleft/` (CGAL, tetgen AGPL) queda prohibida — https://libigl.github.io/license/ | Sin build WASM oficial que yo haya encontrado; es solo cabeceras + Eigen, se puede compilar | Depende de lo que se incluya | Activo | Permitida, pero no trae detección de primitivas. No compensa. |
| **Open3D** | Segmentación de planos por RANSAC, parches planos (de memoria, sin verificar en la doc) | MIT — https://raw.githubusercontent.com/isl-org/Open3D/main/LICENSE | No encontré build WASM oficial | Muy grande | Activo | Licencia bien, impracticable en navegador. |
| **PCL** 1.15.1 | Ajuste de plano, cilindro, esfera y cono por RANSAC (módulo de segmentación; de memoria) | BSD — https://github.com/PointCloudLibrary/pcl (no confirmé la variante de cláusulas) | Sin build WASM oficial | Muy grande, depende de Boost/Eigen/FLANN | Activo | Licencia bien, impracticable. |
| **trimesh** | `facets` (grupos de caras coplanares vecinas), cajas y esferas mínimas | MIT — https://github.com/mikedh/trimesh | No: es Python puro | — | Activo | Solo referencia de cómo define "facet". |
| **OpenCascade (OCCT)** | Núcleo B-rep: representaría planos y cilindros exactos | **LGPL-2.1 con excepción** — https://github.com/Open-Cascade-SAS/OCCT | `opencascade.js`: paquete de casi 50 MB, 9,1 MB con brotli — https://ocjs.org/docs/getting-started/file-size | Enorme | Activo | **Requiere aprobación explícita (LGPL)** y no reconoce primitivas en mallas por sí solo. No recomendada. |
| **geogram** | Remallado y reparación | BSD-3-Clause, con build Emscripten — https://github.com/BrunoLevy/geogram | Sí (demos en navegador) | No verificado | Activo | Permitida; no resuelve detección de primitivas. Reserva. |
| **pmp-library** | Decimación, remallado, curvatura | MIT, "compilación cruzada a JavaScript" — https://github.com/pmp-library/pmp-library | Habría que compilarla | No verificado | Última versión citada 3.0.0 (2023); no confirmé actividad reciente | Permitida; no detecta primitivas. Reserva. |
| **VCGlib / MeshLab** | Filtros de remallado y simplificación | **GPL-3.0** — https://github.com/cnr-isti-vclab/vcglib | — | — | Activo | **Descartada.** |
| **CoACD** | Descomposición convexa aproximada | MIT — https://github.com/SarahWeiii/CoACD (no revisé las licencias de sus dependencias) | Sin build WASM | — | Activo | No sirve al objetivo. |
| **V-HACD** | Ídem | BSD-3-Clause; proyecto en fin de vida, sucedido por CoACD; existe `vhacd-js` 0.0.1 con poco uso — https://npmjs.com/package/vhacd-js | Port JS existente (no confirmé que sea WASM) | — | Sin desarrollo | No sirve al objetivo. |
| **pyRANSAC-3D** | Ajuste de plano, cilindro, cono, esfera, cuboide | Apache-2.0 — https://github.com/leomariga/pyRANSAC-3D | No: Python | — | No verificado | Referencia legible de las fórmulas de ajuste. |
| **build123d `brep_from_stl`** | Reconstruye primitivas B-rep (plano, cilindro, esfera) desde STL con crecimiento de regiones + ajuste | No verifiqué la licencia — https://build123d.readthedocs.io/en/latest/_modules/build123d/brep_from_stl.html | No: Python sobre OCCT | — | — | Confirma que el método recomendado (regiones + ajuste) es el que se usa en la práctica. |

No pude verificar: la licencia del código original de Schnabel (Efficient RANSAC), la de RANSAC.jl, el tamaño de los paquetes npm, y si existe algún paquete npm de detección de primitivas (la búsqueda no encontró ninguno; no es prueba de que no exista). Desde la terminal no hubo acceso a la API de GitHub ni de npm; las licencias salen de las páginas citadas.

**Conclusión de librerías:** no hay una librería permisiva, con build para navegador, que haga "detectar primitivas y sustituirlas". Las que lo hacen completo son GPL (CGAL) o no corren en navegador (PCL, Open3D, Python). Lo bueno: las etapas 1 y 2 son algoritmos clásicos y cortos que se escriben sobre lo que ya hay.

## 4. Recomendación por etapas

### Etapa 0 — Medir antes de escribir (medio día, sin código de producto)

Tomar 5–6 modelos reales (STL CAD sobre-teselado, texto extruido, pieza con muchos agujeros, un escaneo) y anotar: triángulos originales, triángulos tras `simplify` a 0,001 / 0,01 mm, y el mínimo teórico de las zonas planas. Si Manifold ya queda a menos de ~10 % del mínimo, la etapa 1 se reduce a un botón y una explicación. **Esto no lo medí; es la mayor incertidumbre del documento.**

### Etapa 1 — "Limpiar caras planas" (sin pérdida)

- **Qué hace:** fusiona caras coplanares, quita vértices colineales y re-triangula cada polígono. Opción A: exponer `simplify` con tolerancia mínima como acción aparte ("sin pérdida", sin deslizador). Opción B: algoritmo propio (`getFaceAdjacency` → regiones coplanares → contornos → earcut) que además funcione en **mallas abiertas**, donde Manifold no entra.
- **Qué gana quien imprime:** archivos CAD con miles de triángulos planos bajan mucho (una placa con texto puede bajar varias veces) sin cambiar una sola medida; operaciones booleanas, cortes y pintura más rápidos; archivos más livianos. En esculpidos y escaneos: nada, y hay que decirlo en la interfaz.
- **Dificultad:** A: baja (lote de interfaz + pruebas). B: media (lote de motor, ~30–45 min de agente, más QA).
- **Riesgos:** uniones en T si se quita un vértice que la cara vecina aún usa (mitigación: decidir por arista compartida, y `splitTJunctions` como red); triángulos agujas en polígonos largos; pérdida de colores por cara (no fusionar a través de un cambio de color; Manifold ya lo respeta con `faceID`/propiedades); tolerancia de coplanaridad que "aplana" un chaflán muy leve (usar tolerancia de distancia en mm, no solo ángulo).
- **Validación:** `isMeshClosed` antes y después; volumen igual dentro de 1e-6 relativo; caja idéntica; desviación máxima (muestreo de vértices y centroides en ambos sentidos con `meshDistance.ts`) bajo 0,001 mm; mismo número de cáscaras y género; idempotencia (aplicar dos veces no cambia nada).
- **Dependencia nueva:** ninguna.

### Etapa 2 — Reconocer planos, cilindros y esferas; regenerar con segmentos elegidos

- **Qué hace:** (1) regiones por aristas vivas y curvatura; (2) ajuste por mínimos cuadrados de plano, esfera y cilindro, aceptando solo si el error máximo queda bajo una tolerancia en mm y la región cubre un arco suficiente; (3) informe: "12 planos, 4 cilindros Ø 6,00 mm, 1 esfera"; (4) sustitución: nuevos anillos de borde sobre el círculo exacto, pared regenerada con N segmentos y **re-triangulación de las caras vecinas** con el contorno nuevo (por eso depende de la etapa 1).
- **Qué gana quien imprime:** agujeros y ejes con el número de lados que quiera (menos triángulos, o más lados para que un agujero salga redondo); radios exactos en vez de promedios; lectura de diámetros para Medir y para validar encajes (imanes, tornillos: cruza con uniones y objetos de referencia); en escaneos, paredes "casi cilíndricas" quedan limpias. La reducción de triángulos en CAD es modesta salvo que se acepte menos precisión.
- **Entrega parcial útil y barata (2a):** solo detectar e informar (solo lectura, sin tocar la malla). Riesgo cero para la pieza y ya sirve a Medir.
- **Dificultad:** 2a media; 2b (sustituir) alta. La costura con los vecinos es el 80 % del trabajo.
- **Riesgos:** abrir la malla en las costuras; vecinos que no son planos (dos cilindros que se cruzan: la curva de intersección no es un círculo → no sustituir, dejar como está); falsos positivos (un óvalo tratado como círculo cambia la pieza: por eso tolerancia en mm y rechazo estricto); redondeos (un filete es un cuarto de cilindro: detectarlo sí, re-segmentarlo solo si los dos bordes son rectos); tiempos en mallas de más de 500 mil triángulos (correr en el Worker, con cancelación).
- **Validación:** todo lo de la etapa 1, más: desviación máxima ≤ tolerancia elegida (por defecto proponer 0,02 mm), cambio de volumen informado (el aviso de 2 % ya existe), y pruebas con primitivas generadas por `createPrimitiveMesh` con ruido conocido: el ajuste debe recuperar radio y eje dentro del ruido. Si cualquier comprobación falla, se devuelve el objeto intacto con error tipado (patrón de `refine.ts`).
- **Dependencia nueva:** ninguna. Los ajustes lineales y el PCA ya tienen base en `geometryUtils.ts`.

### Etapa 3 — General (conos, toros, VSA, CSG): no ahora

- Conos y toros: mismo esquema de la etapa 2 con ajuste no lineal; solo si la 2 demuestra uso real.
- "Low-poly estilizado" por VSA: es otra función (estética), no preparación para imprimir; no hay librería permisiva lista para navegador y la que existe es GPL.
- Malla → CSG editable: fuera de alcance; alto riesgo y sin base abierta utilizable.
- Descomposición convexa: no aporta a este objetivo.

## 5. Decisiones para el autor

1. **¿Cuál es el objetivo real: menos triángulos, o formas exactas y editables?** Cambia la prioridad. *Recomendación:* si es peso y velocidad, basta etapa 0 + 1. Si es "que los agujeros queden redondos y saber su diámetro", el valor está en la etapa 2a.
2. **¿Se aprueba la etapa 0 (medición) antes de comprometer un lote de motor?** *Recomendación:* sí; puede mostrar que `simplify` ya resuelve la etapa 1 y ahorrar el lote.
3. **Etapa 1: ¿acción separada "Limpiar caras planas (sin pérdida)" o un modo dentro de Simplificar?** *Recomendación:* un modo dentro de Simplificar, primero en la lista, sin deslizador y con el resultado esperado ("no cambia la forma").
4. **¿Debe funcionar en mallas abiertas o sin reparar?** Solo eso justifica el algoritmo propio (opción B). *Recomendación:* no al principio; pedir reparar antes, como hace hoy Simplificar.
5. **Etapa 2: ¿solo informar (2a) o también sustituir (2b)?** *Recomendación:* 2a primero, integrada a Medir; 2b solo para cilindros entre caras planas (agujeros pasantes y ejes), que es el caso común y el único con costura simple.
6. **Tolerancia por defecto para aceptar una primitiva.** *Recomendación:* 0,02 mm de desviación máxima, visible y ajustable; nunca aceptar por parecido visual.
7. **¿Se descartan formalmente CGAL (GPL) y OpenCascade (LGPL, ~9 MB)?** *Recomendación:* sí a ambas; dejarlo anotado en `docs/DECISIONES.md` para no reabrirlo.
8. **meshoptimizer sigue en el ROADMAP como candidata: ¿se mantiene?** *Recomendación:* mantener solo como reserva para mallas enormes o abiertas; no agregarla por este tema.

## Fuentes

- Manifold: `node_modules/manifold-3d/manifold.d.ts` (3.5.5) · https://github.com/elalish/manifold
- CGAL: https://doc.cgal.org/latest/Manual/packages.html · https://www.cgal.org/license.html · https://doc.cgal.org/6.2/Shape_detection/group__PkgShapeDetectionRef.html
- meshoptimizer: https://github.com/zeux/meshoptimizer · https://cdn.jsdelivr.net/npm/meshoptimizer@1.3.0/README.md
- libigl: https://libigl.github.io/license/ · Open3D: https://raw.githubusercontent.com/isl-org/Open3D/main/LICENSE · PCL: https://github.com/PointCloudLibrary/pcl · trimesh: https://github.com/mikedh/trimesh
- OCCT: https://github.com/Open-Cascade-SAS/OCCT · https://ocjs.org/docs/getting-started/file-size
- geogram: https://github.com/BrunoLevy/geogram · pmp-library: https://github.com/pmp-library/pmp-library · VCGlib: https://github.com/cnr-isti-vclab/vcglib
- CoACD: https://github.com/SarahWeiii/CoACD · V-HACD: https://npmjs.com/package/vhacd-js · pyRANSAC-3D: https://github.com/leomariga/pyRANSAC-3D
- Artículos (citados de memoria, sin releerlos): Schnabel, Wahl y Klein, «Efficient RANSAC for Point-Cloud Shape Detection», 2007 — https://cg.cs.uni-bonn.de/backend/v1/files/publications/schnabel-2007-efficient.pdf ; Cohen-Steiner, Alliez y Desbrun, «Variational Shape Approximation», SIGGRAPH 2004.
