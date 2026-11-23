/**
 * @file scripts/docs-mcp-tabla.mjs
 * @description Genera la tabla de herramientas `kura_*` de `docs/MCP.md` desde el servidor real: lo inicia
 * por stdio (`mcp-server/dist/index.js`, compilar antes con `npm run mcp:build`), pide `tools/list` y
 * reemplaza el bloque entre `<!-- TABLA-HERRAMIENTAS:INICIO -->` y `<!-- TABLA-HERRAMIENTAS:FIN -->`.
 * Así la tabla no se desactualiza. Con `--comprobar` no escribe: falla si el documento no coincide.
 * Uso: `npm run docs:mcp` (o `npm run docs:mcp -- --comprobar`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const servidor = resolve(raiz, 'mcp-server/dist/index.js');
const doc = resolve(raiz, 'docs/MCP.md');
const comprobar = process.argv.includes('--comprobar');
const INICIO = '<!-- TABLA-HERRAMIENTAS:INICIO -->';
const FIN = '<!-- TABLA-HERRAMIENTAS:FIN -->';

if (!existsSync(servidor)) {
  console.error('Falta mcp-server/dist/index.js: corre `npm run mcp:build` primero.');
  process.exit(1);
}

// El SDK vive en mcp-server/node_modules.
const req = createRequire(resolve(raiz, 'mcp-server/package.json'));
const sdk = (ruta) => import(pathToFileURL(req.resolve(ruta)).href);
const { Client } = await sdk('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = await sdk('@modelcontextprotocol/sdk/client/stdio.js');

/** Escapa lo que rompe una celda de tabla Markdown. */
const celda = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();

/** Resume un parámetro: `nombre*` (obligatorio) con su tipo o sus valores. */
function resumenParametro(nombre, def, obligatorio) {
  let tipo = def.type ?? (def.anyOf ? 'varios' : 'valor');
  if (Array.isArray(def.enum)) tipo = def.enum.map((v) => `\`${v}\``).join(' · ');
  else if (tipo === 'array') tipo = `lista${def.items?.type ? ` de ${def.items.type}` : ''}`;
  else if (tipo === 'object') tipo = 'objeto';
  return `\`${nombre}\`${obligatorio ? '*' : ''}${tipo && !tipo.startsWith('`') ? ` (${tipo})` : ` (${tipo})`}`;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [servidor],
  env: { ...process.env, KURA_BRIDGE_TOKEN: '', KURA_BRIDGE_PORT: '17999' },
  stderr: 'ignore',
});
const client = new Client({ name: 'docs-mcp-tabla', version: '1.0.0' });
await client.connect(transport);
const { tools } = await client.listTools();
await client.close();

tools.sort((a, b) => a.name.localeCompare(b.name));
const filas = tools.map((t) => {
  const props = t.inputSchema?.properties ?? {};
  const req = new Set(t.inputSchema?.required ?? []);
  const nombres = Object.keys(props);
  const principales = nombres
    .sort((a, b) => Number(req.has(b)) - Number(req.has(a)))
    .slice(0, 6)
    .map((n) => resumenParametro(n, props[n] ?? {}, req.has(n)));
  if (Object.keys(props).length > 6) principales.push(`… (+${Object.keys(props).length - 6})`);
  const acceso = t.annotations?.readOnlyHint ? 'lectura' : 'escritura';
  return `| \`${t.name}\` | ${acceso} | ${celda(t.description)} | ${principales.join(', ') || '—'} |`;
});

const tabla = [
  INICIO,
  `<!-- Generada por \`npm run docs:mcp\` desde el servidor real (${tools.length} herramientas). No la edites a mano. -->`,
  '',
  '| Herramienta | Acceso | Qué hace | Parámetros principales (`*` = obligatorio) |',
  '| :--- | :--- | :--- | :--- |',
  ...filas,
  '',
  FIN,
].join('\n');

const actual = readFileSync(doc, 'utf8');
const i = actual.indexOf(INICIO);
const f = actual.indexOf(FIN);
if (i < 0 || f < 0) {
  console.error(`docs/MCP.md no tiene los marcadores ${INICIO} y ${FIN}.`);
  process.exit(1);
}
const nuevo = actual.slice(0, i) + tabla + actual.slice(f + FIN.length);
if (comprobar) {
  if (nuevo !== actual) {
    console.error('La tabla de docs/MCP.md está desactualizada: corre `npm run docs:mcp`.');
    process.exit(1);
  }
  console.log(`Tabla al día (${tools.length} herramientas).`);
} else {
  writeFileSync(doc, nuevo);
  console.log(`docs/MCP.md actualizado con ${tools.length} herramientas.`);
}
