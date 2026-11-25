# Formas simples: reducir triángulos reconociendo primitivas — diseño

Estado: investigación (24-nov-2026) y medición (25-nov-2026, sección 4); nada implementado ni decidido. Responde a la pregunta del autor: ¿se puede bajar el número de triángulos de un modelo reemplazando zonas por figuras más simples (planos, cilindros, esferas, conos, cajas), y con qué?

**Respuesta corta.** Sí, y en tres escalones muy distintos de costo. Lo plano es barato, exacto y casi todo existe ya en el repo. Los cilindros, esferas y conos se pueden reconocer con geometría clásica (sin IA y sin dependencia nueva), pero en mallas CAD **no bajan triángulos gratis**: una pared de cilindro con N segmentos ya usa el mínimo (2N); bajar N es perder precisión, igual que decimar. Lo que sí da reconocerlos es regenerarlos con los segmentos que uno elija, radios exactos, medir diámetros y limpiar escaneos. La conversión general de malla a CSG es investigación abierta y no se recomienda.

## 1. Qué hay hoy en el repo

Corrección al encargo: **Kurra Studio no usa meshoptimizer**. Figura como candidata en `docs/ROADMAP.md:57`, pero no está en `package.json`. La simplificación actual es de Manifold.

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
| **Conversión a CSG / B-rep** (ingeniería inversa) | Reconstruir el modelo como operaciones entre primitivas (caja menos cilindro…), editable. | Posible en piezas prismáticas simples; se rompe con redondeos, superficies libres y roscas. | No aplica. | Muy alta; es tema de investigación vigente y de productos comerciales. Fuera de escala para Kurra Studio. |

Tres hechos que conviene tener claros antes de decidir:

1. **Decimar con tolerancia chica ya hace casi todo el trabajo plano.** `Manifold.simplify` colapsa aristas mientras la superficie no se mueva más que la tolerancia: en una zona plana eso es "gratis". Medido: a 0,001 mm queda a menos del 0,13 % del mínimo plano (ver «Medición (25-nov-2026)»).
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

### Medición (25-nov-2026)

Hecha con el motor real desde `src/engine/__tests__/simplifyMeasure.perf.test.ts` (`npm run test:perf`; apoyo en `simplifyMeasureSupport.ts`, `simplifyMeasurePlanar.ts` y `simplifyMeasurePrimitives.ts`). Lee los modelos de la carpeta local `.eval-tmp/modelos/` (de terceros, no se versionan; sin ella la prueba se salta) y escribe los números crudos en `.eval-tmp/medicion-simplificar/`. Nada de la app cambió.

**Método.**
- *Simplificar:* `Manifold.simplify(tol)` directo sobre cada cuerpo cerrado (lo mismo que hace `simplifyMesh` en `analysis.ts`, sin la escala del objeto). 0,001 y 0,005 mm están **bajo el mínimo que hoy acepta la app** (0,01 mm, `operationLimits.ts`); la interfaz propone 0,15 mm por defecto (`RightInspector.tsx`), que no medí exacto (está entre 0,1 y la siguiente).
- *Desviación:* Hausdorff aproximado en ambos sentidos con `three-mesh-bvh`: vértices del original contra la superficie simplificada, y centroides de los triángulos simplificados contra el original; hasta 150 000 muestras por sentido (cota inferior del máximo real).
- *Cerrada:* `isMeshClosed` sobre el resultado (salió cerrada en el 100 % de los casos). *Género:* el de Manifold antes y después; si cambia, se abrió o se cerró un agujero, es decir, cambió la forma.
- *Cota de lo plano:* regiones crecidas desde una semilla sobre `getFaceAdjacency` (normal a menos de 0,1° de la semilla y los tres vértices a menos de 0,001 mm de su plano); mínimo por región = aristas del contorno − 2 + 2 × agujeros (se conservan todos los vértices del contorno, así no se toca a las vecinas). Se calcula sobre el original y sobre el resultado de 0,001 mm: **la diferencia en este último es lo que ganaría un lote de «limpiar caras planas»**.
- *Indicio de primitivas:* regiones suaves (diedro < 20° entre vecinos, sin las caras planas de 3+ triángulos), 12+ triángulos; si las normales caben en un plano se ajusta un cilindro (eje = autovector menor de Σ n nᵀ, círculo de Kåsa), si no una esfera (Kåsa 3D); se acepta con desviación máxima de los vértices < 0,02 mm. Validado con las primitivas de la app (cilindro, esfera y los 8 cilindros de la caja salen reconocidos; el cubo y el texto no). Es una **cota inferior**: una región que mezcla un plano tangente y un redondeo se descarta entera, y los conos y toros no se buscan.

**Modelos reales** (11 de los 23 archivos de la carpeta; tipo a ojo por los números: CAD = mucha superficie plana o cilíndrica).

| Archivo | Tipo | Triángulos | A 0,001 mm | A 0,01 mm | Desv. a 0,01 | Vol. a 0,01 | Género igual a 0,01 | Plano del original (mínimo) | Ganancia plana sobre 0,001 | Cil. + esf. |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|
| Starwars_AT-AT.3mf | CAD | 1 280 182 ¹ | 59,3 % | 38,3 % | 0,025 mm | −0,005 % | sí | 79,1 % (57,2 %) | 980 (0,13 %) | 8,5 % |
| pack_fidget_NG.3mf | CAD | 3 110 214 | 79,0 % | 46,0 % | 0,036 mm | −0,089 % | **no** (ya a 0,001) | 32,1 % (30,9 %) | 18 (0,00 %) | 4,7 % |
| llaveros.3mf | CAD | 2 916 ² | 100 % | 68,2 % | 0,007 mm | −0,23 % | sí | 100 % (100 %) | 0 | 0 % |
| ocarina.3mf | mixto | 38 144 | 98,5 % | 87,5 % | 0,011 mm | +0,000 % | sí | 27,3 % (27,3 %) | 0 | 2,9 % |
| NeroBlackClover_SeparatePlate.3mf | orgánico, base plana | 271 584 | 93,0 % | 65,2 % | 0,130 mm | +0,000 % | **no** (ya a 0,001) | 19,4 % (15,4 %) | 49 (0,02 %) | 0,1 % |
| obj_1_tinker.obj.stl | orgánico | 183 128 | 99,9 % | 99,7 % | 0,157 mm | −0,000 % | sí (no a 0,05) | 2,0 % (2,0 %) | 0 | 0 % |
| Sagradocorazon.3mf | orgánico | 499 836 | 100 % | 98,8 % | 0,020 mm | −0,002 % | sí (no a 0,05) | 2,6 % (2,6 %) | 0 | 0 % |
| Spiral+Phoenix+12cm+STL.stl | orgánico | 253 248 | 100 % | 96,4 % | 0,017 mm | −0,003 % | sí | 3,4 % (3,4 %) | 0 | 0 % |
| obj_1_obj_1_300mm helmet.stl | orgánico | 386 962 | 100 % | 100 % | 0,036 mm | −0,000 % | sí | 0,9 % (0,9 %) | 0 | 0 % |
| frierenmw.stl | orgánico | 477 684 | 99,8 % | 83,7 % | 0,019 mm | −0,014 % | **no** (desde 0,005) | 5,7 % (5,7 %) | 0 | 0,0 % |
| busto_anubis_gotico.stl | orgánico | 325 650 | — | — | — | — | — | — | — | — |

¹ 10 de 11 cuerpos (uno no es cerrado). ² Solo 3 de los 7 cuerpos distintos son cerrados (los otros 4, con 24–30 aristas abiertas, suman 136 340 triángulos y Manifold los rechaza, como Simplificar en la app). El busto quedó fuera por lo mismo (8 aristas abiertas). Porcentajes de triángulos respecto del original; «plano del original» = triángulos en regiones coplanares de 2+ triángulos y, entre paréntesis, su mínimo teórico, ambos sobre el total.

A tolerancias mayores (mismo orden de filas): a 0,05 mm quedan 18,1 · 15,2 · 51,2 · 59,9 · 36,3 · 96,3 · 67,8 · 37,1 · 99,3 · 22,7 %, con desviaciones de 0,04 a 0,67 mm; a 0,1 mm, 11,1 · 11,5 · 41,8 · 38,7 · 23,9 · 84,3 · 38,7 · 16,3 · 93,0 · 12,8 %, con desviaciones de 0,09 a 1,48 mm, cambios de volumen de hasta −2,8 % (llaveros) y género cambiado en 6 de 10. Tiempos: menos de 7 s por tolerancia en el más grande (3,1 M de triángulos); ninguno se acercó al corte de 2 min.

**Piezas generadas por la app.**

| Pieza | Triángulos | 0,001 → 0,01 mm | 0,05 mm | 0,1 mm | Mínimo plano | Cil. + esf. |
|---|---:|---|---|---|---:|---:|
| Cubo | 12 | 12 | 12 | 12 | 12 | 0 % |
| Cilindro 64 lados | 252 | 252 | 252 | 108 (vol. −1,0 %, desv. 0,096) | 252 | 51 % (la pared) |
| Esfera | 512 | 512 | 512 | 512 | — | 100 % |
| Caja con tapa (Asistentes) | 1 076 | 1 076 | 788 (desv. 0,048) | 760 (desv. 0,78) | 1 068 | 46 % (8 cilindros) |
| Texto 3D «Kurra Studio» | 900 | 900 | 852 (desv. 0,040) | 756 (desv. 0,080) | 900 | 2 % |
| Rosca M8 × 16 | 5 330 | 5 322 → 5 296 (desv. 0,004) | 5 224 (desv. 0,061) | 3 118 (vol. −0,36 %) | 2 834 de 2 836 | 49 % |

Lo que crea la app **ya está en su mínimo**: Simplificar a ≤ 0,01 mm no le quita nada (la rosca, 34 triángulos) y la cota plana coincide con lo que hay (la caja, 8 triángulos de 1 076). Lo que baja a 0,05–0,1 mm es pérdida de forma: menos lados en el cilindro, letras y redondeos achatados.

**Conclusiones.**
1. **Las caras planas ya las limpia `simplify`.** Tras 0,001 mm, lo que quedaría por re-triangular en regiones planas es como mucho el 0,13 % (AT-AT, 980 de 759 538); en los otros, 0–49 triángulos. Antes de simplificar, la cota plana sí es grande en CAD (AT-AT: 79 % de los triángulos en regiones planas, mínimo 57 %), y `simplify` a 0,001 mm llega prácticamente a ese mínimo (59 %). Un algoritmo propio de caras planas **no ganaría nada medible** en mallas cerradas.
2. **La ganancia grande está en CAD sobre-teselado y a tolerancia mínima**: AT-AT baja al 59 % a 0,001 mm y al 38 % a 0,01 mm; el pack, al 79 % y al 46 %. En lo orgánico, 0,001–0,01 mm deja entre 84 y 100 %: ahí casi no hay nada que quitar sin perder forma, y hay que decirlo en la interfaz.
3. **La tolerancia de Manifold no es una cota de desviación.** A 0,01 mm, 9 de 10 modelos se desvían más de 0,01 mm (hasta 0,157 mm), y el casco se desvía 0,036 mm sin perder un solo triángulo. En una sonda aparte sobre el casco a 0,001 mm, con todos los vértices y centroides: ningún vértice nuevo ni movido, pero 14 centroides a más de 0,001 mm (máx. 0,009 mm); el desvío viene de cambiar diagonales, que Manifold hace aunque no colapse nada (inferido de esos números; no lo verifiqué en el código de Manifold). Además, el género cambia en 3 modelos ya a 0,001–0,005 mm (Manifold cierra agujeritos o rendijas de ese orden). Esto vale también para el valor por defecto actual (0,15 mm): a 0,1 mm ya hay desviaciones de 0,2–1,5 mm y cambios de género.
4. **Primitivas: poco y sin ahorro.** Cilindros y esferas reconocibles (< 0,02 mm) son el 8,5 % de los triángulos en el modelo más CAD, 4,7 % en el pack, 2,9 % en la ocarina y ~0 % en lo orgánico; y esos cilindros ya usan 2N triángulos, así que regenerarlos no baja nada sin aceptar menos lados. Su valor sigue siendo el de la etapa 2a (medir diámetros, informar), no el peso.

**Recomendación: (a)**. No hace falta un lote de «figuras simples» para bajar triángulos. Basta un lote chico sobre Simplificar:
- agregar un modo **«sin pérdida»** = `simplify(0,001)` (hoy el rango empieza en 0,01 mm; habría que bajarlo a 0,001 para ese modo), que en los dos CAD grandes da 21–41 % menos triángulos y en lo orgánico casi nada;
- como la tolerancia no garantiza la desviación, **verificar después**: mismo género, cambio de volumen < 0,01 % y desviación muestreada (`three-mesh-bvh`, como esta medición) bajo un límite; si falla, devolver el objeto intacto con aviso, o probar sin el cuerpo que cambió;
- **bajar el valor por defecto** de 0,15 mm a 0,01–0,02 mm y mostrar la desviación medida en el resultado, porque 0,15 mm ya achata cilindros y texto.

Las etapas 1 y 2b no se justifican por triángulos con estos datos; la 2a (detectar e informar cilindros) sigue en pie solo si se quiere para Medir.

**Lo que no se midió.** Los 7 archivos de más de ~1,2 M de triángulos o duplicados en otro formato (`busto_pablo_victor.stl`, `busto_personal_fernando.*`, `fernando_ito_josefa_2.stl`, `obj_1_Saitama_75mm_base.stl` y `Saitama_75mm_base.3mf`, `pedido_felipe_regalo_papa_2026-11-05.*`, `DAFFY.3mf`, `frierenmw.3mf`, `Spiral+Phoenix+12cm+STL.3mf`, `obj_1_OcarinaDeluxe.stl`), por tiempo; son orgánicos a ojo y no cambiarían la conclusión plana. Los cuerpos abiertos (4 de 7 en llaveros, el busto anubis) tampoco: Manifold no los acepta, y ahí un algoritmo propio sí podría servir (ver decisión 4). La tolerancia exacta de 0,15 mm. Conos, toros y redondeos mezclados con planos (el indicio de primitivas es cota inferior). Si los cambios de género a 0,001 mm se ven al imprimir (son detalles del orden de la tolerancia). La desviación es muestreada (hasta 150 000 puntos por sentido), no exacta.

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

1. **¿Cuál es el objetivo real: menos triángulos, o formas exactas y editables?** Cambia la prioridad. *Recomendación (ajustada por la medición):* si es peso y velocidad, basta el modo «sin pérdida» de Simplificar con verificación; la etapa 1 no gana nada medible. Si es "que los agujeros queden redondos y saber su diámetro", el valor está en la etapa 2a.
2. **Medición previa:** hecha (25-nov-2026); mostró que `simplify` ya resuelve la etapa 1. ¿Se aprueba el lote chico de la recomendación (a)?
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
