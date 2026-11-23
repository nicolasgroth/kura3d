# Glosario de textos de la interfaz

Vocabulario único para los textos visibles (público: makers aficionados, no ingenieros CAD). Los textos nuevos deben seguirlo; `src/i18n/brandLanguage.test.ts` vigila lo que se puede vigilar.

| Concepto | Usa (es) | Evita | Notas |
|---|---|---|---|
| Objeto que se imprime | **Sólido** | "pieza positiva" | En inglés: Solid |
| Objeto que se resta de otros | **Negativo** | "hueco", "agujero", "módulo −", "Hueco (Resta)" | En inglés: Negative. Atajo H alterna Sólido / Negativo |
| Acción de quitar volumen | **Restar** (y "Aplicar restas") | "aplicar huecos", "resta" como sustantivo del objeto, "resta booleana" | Unir / Restar / Intersectar. Con cantidad: «Aplicar 1 resta», «Aplicar 3 restas» |
| Lo agregado desde el menú contextual | **pieza** / **pieza negativa** | "módulo (+)", "módulo (−)" | Aviso: «Pieza agregada: Cilindro. Muévela donde la necesites.» |
| Vaciar un objeto por dentro | **Ahuecar** | "Shell" | Un tubo hueco sigue siendo "Tubo hueco" (forma, no negativo) |
| Malla sin agujeros | **Malla cerrada** | "Watertight", "manifold" | |
| Textura de superficie irregular | **Textura rugosa** | "Fuzzy Skin" | |
| Cierre convexo de piezas | **Envolvente convexa** | "Hull", "Convex Hull" | |
| Conector cuadrado | **Clavija cuadrada** | "Peg" | Cola de milano sin "(Dovetail)" |
| Apariencia de material | **Material** | "PBR" | |
| Manipulador 3D del visor | **manipulador** | "gizmo" | |
| Consejo | **Consejo** | "Tip", "Pro Tips" | |
| Superficie de impresión | **cama** (en inglés: **bed**) | "placa", "build plate" | Una sola palabra en todos los idiomas; el rótulo "Placa 1" de Preparar para imprimir nombra una cama concreta |
| Corte con un plano | **Corte por plano + uniones** (en inglés: Plane cut + connectors) | "con Conectores 3D" | Mismo nombre en el menú, el inspector y el título del diálogo; el resultado se llama **mitad A / mitad B** |
| Piezas de Dividir para imprimir | **pieza** con código **A1, A2, B1a…** | "mitad" | Los códigos rotulan cada pieza; "mitad A/B" es solo el resultado del corte por plano |
| Ventana de preferencias | **Ajustes** (en inglés: Settings) | "Ajustes y Puente MCP" | El puente MCP es una pestaña de Ajustes, no parte del título |
| Nombre del producto | **Kura3D** | "Pro", "Ultra", "Maker Pro" | Ver `src/brand.ts` |

Tamaño de texto: ningún texto de la interfaz baja de 11 px. Los números siguen el formato del idioma (coma decimal en español, alemán y francés; punto en inglés) tanto en campos como en rangos (`src/i18n/numberLocale.ts`).

Se conservan siglas que el público ya usa: STL, 3MF, SVG, MCP, slicer/laminador, CSG solo en documentación técnica.

## Atajos de teclado

Los atajos van **alineados a la derecha** como atajo del ítem (`shortcut` en `MenuItem`, `kbd` en la paleta), nunca entre paréntesis dentro de la etiqueta. En descripciones largas (tooltips) pueden ir entre paréntesis al final.
