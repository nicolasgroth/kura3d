# Avisos de terceros

Kurra Studio se distribuye con licencia MIT. Incluye o empaqueta los siguientes componentes de terceros,
cada uno bajo su propia licencia. Las dependencias de npm instaladas como paquetes conservan su
archivo de licencia en `node_modules/<paquete>/`; aquí se listan las que se copian dentro del
repositorio o que tienen avisos que deben acompañar la distribución.

## Fuentes tipográficas

### Roboto Bold (subconjunto Latin)

- Uso: contornos de la primitiva de texto 3D y de la proyección de texto sobre superficies.
- Archivo: `src/assets/fonts/Roboto-Bold-latin.woff` (embebido en base64 en
  `src/engine/text/fonts/robotoBoldLatin.ts` por `scripts/embed-font.mjs`).
- Origen: Roboto, The Roboto Project Authors (https://github.com/googlefonts/roboto-classic),
  subconjunto Latin (U+0000–00FF y signos comunes) distribuido por Fontsource
  (`@fontsource/roboto` 5.3.0).
- Licencia: SIL Open Font License 1.1. Texto completo en `src/assets/fonts/Roboto-OFL.txt`.
- Copyright 2011 The Roboto Project Authors.

## Bibliotecas

### opentype.js

- Uso: lectura de la fuente (contornos Bézier, avances y kerning) en navegador, Worker y Node.
- Versión: 2.0.x. Repositorio: https://github.com/opentypejs/opentype.js
- Licencia: MIT. Copyright (c) 2020 Frederik De Bleser.

### @xmldom/xmldom

- Uso: lectura del XML de los SVG (importación, proyección y MCP sin interfaz) con el mismo
  resultado en navegador, Worker y Node, antes de pasar el árbol a `THREE.SVGLoader`.
- Versión: 0.9.x. Repositorio: https://github.com/xmldom/xmldom
- Licencia: MIT. Copyright 2019 - present Christopher J. Brody and other contributors;
  Copyright 2012 - 2017 @jindw and other contributors.

## Dependencias solo de desarrollo con licencia LGPL

### sharp y libvips

- Uso: ninguno directo. Llega de forma indirecta por `manifold-3d` → `@gltf-transform/functions` →
  `ndarray-pixels` → `sharp`. Kurra Studio no lo importa ni lo ejecuta.
- Alcance: solo queda en `node_modules` al desarrollar. No entra en el paquete web, en el servidor
  MCP publicado ni en el instalador de escritorio.
- Licencias: `sharp` es Apache-2.0. Sus binarios precompilados (`@img/sharp-win32-x64`,
  `@img/sharp-wasm32` y equivalentes de otras plataformas) incluyen libvips, con licencia
  LGPL-3.0-or-later. Repositorios: https://github.com/lovell/sharp y https://github.com/libvips/libvips
- Aprobación: aceptado por el autor el 23 de noviembre de 2026 como dependencia de desarrollo
  (ver `docs/DECISIONES.md`). Si alguna vez pasara a distribuirse, hay que revisarlo de nuevo.
