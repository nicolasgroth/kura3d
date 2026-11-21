# Roadmap de Kura3D

Actualizado el 21 de noviembre de 2026. Este documento fija las prioridades; el detalle por ticket sigue en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md) y el flujo de agentes en [CLAUDE.md](../CLAUDE.md).

## Para qué existe Kura3D

Reunir en una sola herramienta abierta lo que hoy está repartido en varias: tomar o crear un modelo 3D y dejarlo **listo para imprimir**, sea una pieza chica con encajes precisos o una figura de un metro que hay que dividir, etiquetar y armar. El trabajo del slicer (boquillas, extrusión, G-code) queda fuera; Kura3D entrega archivos que los slicers abren sin sorpresas.

## Casos que deben funcionar de punta a punta

1. **Figura grande por partes.** Importar una estatua de 1 m, indicar la cama (por ejemplo 250 mm), dividirla en piezas que caben, con uniones, cada pieza con nombre y marcas de pareja (A–A, B–B) grabadas en las caras internas, vista explosionada con animación de armado y exportación por pieza o por placa.
2. **Tubería o estructura larga.** Un tramo de 1 m × 1 m dividido en segmentos imprimibles con acoples macho/hembra y holgura configurable.
3. **Caja con tapa roscada.** Base y tapa que enroscan, con holgura ajustable y verificación de interferencia.
4. **Separar por color o material.** Dividir un modelo por colores para imprimirlos aparte, o exportarlo multimaterial en 3MF.
5. **De imagen a modelo.** Generar una figura 3D desde una imagen y pasarla por los casos anteriores.
6. **Conversar con el modelo.** Un chat al lado del visor que entiende la escena, propone cambios, los previsualiza y los aplica con deshacer.

## Orden de trabajo

| Etapa | Qué se entrega | Tickets relacionados |
|---|---|---|
| **0. Base confiable** | Seguridad (CSP de Tauri, claves fuera de `localStorage`, puente MCP con token obligatorio, auditoría de dependencias). Pruebas E2E reales con Playwright sobre la web. Dividir `useKuraStore.ts`, `Dialogs.tsx`, `RightInspector.tsx` y `Viewport3D.tsx`. Un solo motor compartido entre app y servidor MCP. Geometría pesada en Workers. | TRUST-01 a 04, QA-02, CORE-01, PERF-01 |
| **1. Dividir para imprimir** | Corte automático según volumen de cama, plano de corte asistido, uniones vinculadas entre mitades, nombres y marcas de pareja, vista explosionada animada, exportación por pieza y por placa. | GEO-02, FIT-01, ASSY-01, PLATE-01/03, GUIDE-01 |
| **2. Encajes precisos** | Roscas emparejadas con holgura, tapa roscada, acoples de tubería, chequeo de interferencia y holgura. | FIT-02, GEO-04, MEAS-01 |
| **3. Color y multimaterial** | Separación por color o región, asignación de material/filamento por pieza, 3MF verificado en OrcaSlicer, Bambu Studio, Snapmaker Orca, PrusaSlicer y Cura. Importación 3MF con componentes, instancias y posición original. | COLOR-01, IO-01, PLATE-03 |
| **4. IA universal** | Chat que opera la escena con previsualización y aprobación. Proveedores: Anthropic, OpenAI, Gemini, Ollama y **cualquier API compatible con OpenAI** (DeepSeek, Qwen, OpenRouter, LM Studio) con URL y modelo configurables. Imagen → 3D mediante modelos abiertos (locales o por API), como módulo opcional. | AI-01, API-01, VOZ-01 |
| **5. Extras** | Estimación de material por pieza, más formatos, extensiones, instaladores firmados. | REL-01, EXT-01 |

La etapa 0 corre en paralelo con la 1. Las etapas 1 a 3 comparten el modelo de piezas, placas y uniones, que se diseña una sola vez al empezar la etapa 1.

## Formatos

| Formato | Importar | Exportar | Nota |
|---|---|---|---|
| STL | sí | sí | Sin color ni unidades. |
| 3MF | sí | sí | Formato principal: color, material, varias piezas y placas. |
| OBJ | sí | sí | Falta MTL para color. |
| GLB/glTF | — | propuesto | Para compartir y ver en web con color. |
| PLY | propuesto | propuesto | Común en escaneo 3D y modelos generados por IA. |
| STEP | exploración | exploración | Requiere kernel B-Rep (OpenCascade, LGPL): decisión aparte. |

## Librerías abiertas candidatas

Se evalúan antes de escribir código propio. Solo licencias permisivas.

| Necesidad | Candidata | Licencia |
|---|---|---|
| Colisiones, medición, selección rápida | three-mesh-bvh | MIT |
| Paneles acoplables | dockview | MIT |
| Pruebas E2E | Playwright | Apache-2.0 |
| Simplificación de mallas grandes | meshoptimizer | MIT |
| Exportar GLB | GLTFExporter de three.js | MIT |
| Claves en el sistema operativo | keyring (crate Rust) | MIT/Apache-2.0 |

## Fuera de alcance

Laminado, G-code, perfiles de boquilla y extrusor, control de impresoras, simulación FEA/CFD.
