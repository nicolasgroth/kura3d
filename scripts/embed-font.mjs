/**
 * @file scripts/embed-font.mjs
 * @description Genera un módulo TS con una fuente .woff de `src/assets/fonts/` en base64, para que el
 * motor la cargue igual en navegador, Worker y Node (pruebas, servidor MCP) sin red ni `fs`.
 * Uso: node scripts/embed-font.mjs <archivo.woff> <ruta-salida.ts> <NOMBRE_CONSTANTE>
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const [input, output, constName] = process.argv.slice(2);
if (!input || !output || !/^[A-Z][A-Z0-9_]*$/.test(constName ?? '')) {
  console.error('Uso: node scripts/embed-font.mjs <archivo.woff> <salida.ts> <NOMBRE_CONSTANTE>');
  process.exit(1);
}

const base64 = readFileSync(input).toString('base64');
const lines = base64.match(/.{1,120}/g) ?? [];
const source = `/**
 * @file ${output.replace(/\\/g, '/')}
 * @description Generado por scripts/embed-font.mjs desde src/assets/fonts/${basename(input)}: NO EDITAR A MANO.
 * Fuente con licencia SIL OFL 1.1 (ver src/assets/fonts y THIRD_PARTY_NOTICES.md).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export const ${constName} =
${lines.map((l) => `  '${l}'`).join(' +\n')};
`;
writeFileSync(output, source);
console.log(`${output}: ${base64.length} caracteres base64`);
