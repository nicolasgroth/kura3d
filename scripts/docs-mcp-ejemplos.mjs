/**
 * @file scripts/docs-mcp-ejemplos.mjs
 * @description Ejecuta contra el motor sin interfaz (servidor MCP real por stdio, `mcp-server/dist/index.js`)
 * los ejemplos de punta a punta de `docs/MCP.md`: caja con agujero, dividir un modelo grande, medir un
 * volumen y caja con esquinas redondeadas. Imprime cada llamada y un resumen de la respuesta; sale con código 1 si algún resultado difiere
 * de lo documentado. Uso: `npm run mcp:build && node scripts/docs-mcp-ejemplos.mjs`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(raiz, 'mcp-server/package.json'));
const sdk = (ruta) => import(pathToFileURL(req.resolve(ruta)).href);
const { Client } = await sdk('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = await sdk('@modelcontextprotocol/sdk/client/stdio.js');

const carpeta = mkdtempSync(join(tmpdir(), 'kura-mcp-ejemplos-'));
const client = new Client({ name: 'docs-mcp-ejemplos', version: '1.0.0' });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: [resolve(raiz, 'mcp-server/dist/index.js')],
  env: { ...process.env, KURA_BRIDGE_TOKEN: '', KURA_BRIDGE_PORT: '17998', KURA_EXPORT_DIR: carpeta },
  stderr: 'ignore',
}));

let fallos = 0;
async function llamar(nombre, args) {
  console.log(`\n> ${nombre} ${JSON.stringify(args)}`);
  const r = await client.callTool({ name: nombre, arguments: args });
  const texto = r.content?.[0]?.text ?? '';
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  if (r.isError) { console.log('  ERROR:', String(datos).slice(0, 300)); fallos++; return datos; }
  console.log('  ' + JSON.stringify(datos).slice(0, 700));
  return datos;
}
function esperar(cond, msg) { if (!cond) { console.log(`  FALLA: ${msg}`); fallos++; } else console.log(`  ok: ${msg}`); }

console.log('== Ejemplo 1: una caja con un agujero ==');
const caja = await llamar('kura_create_primitive', { primitiveType: 'box', name: 'Caja', params: { width: 40, depth: 30, height: 20 } });
const cil = await llamar('kura_create_primitive', { primitiveType: 'cylinder', name: 'Agujero', params: { radius: 5, height: 30 }, placement: 'origin' });
const resta = await llamar('kura_boolean_operation', { targetId: caja.id, toolIds: [cil.id], operation: 'subtract', resultName: 'Caja con agujero' });
const rid = resta.resultId ?? resta.id;
esperar(Boolean(rid), 'la resta devuelve un objeto nuevo');
const med = await llamar('kura_measure_object', { objectId: rid });
const vol = med.volumeMm3 ?? med.volume?.mm3;
esperar(typeof vol === 'number' && Math.abs(vol - (40 * 30 * 20 - Math.PI * 25 * 20)) < 40, `volumen ≈ ${Math.round(40 * 30 * 20 - Math.PI * 25 * 20)} mm³ (obtenido ${vol})`);
await llamar('kura_export_stl', { outputPath: 'caja-con-agujero.stl', objectIds: [rid] });

console.log('\n== Ejemplo 2: dividir un modelo grande ==');
const grande = await llamar('kura_create_primitive', { primitiveType: 'box', name: 'Estante', params: { width: 400, depth: 200, height: 180 } });
const plan = await llamar('kura_split_for_bed', { objectId: grande.id, dryRun: true });
const piezas = plan.pieces ?? plan.plan?.pieces ?? plan.summary?.pieces;
console.log('  piezas del plan:', JSON.stringify(piezas)?.slice(0, 120));
const dividido = await llamar('kura_split_for_bed', { objectId: grande.id });
const val = await llamar('kura_validate_assembly', { groupId: grande.id });
esperar(Boolean(dividido), 'la división responde');
esperar(Boolean(val), 'la validación del armado responde');

console.log('\n== Ejemplo 3: medir un volumen ==');
const vaso = await llamar('kura_create_primitive', { primitiveType: 'cylinder', name: 'Vaso', params: { radius: 20, height: 50 }, placement: 'origin' });
const hueco = await llamar('kura_create_primitive', { primitiveType: 'cylinder', name: 'Interior', params: { radius: 18, height: 48 }, position: [0, 0, 2], placement: 'origin' });
const vasoHueco = await llamar('kura_boolean_operation', { targetId: vaso.id, toolIds: [hueco.id], operation: 'subtract', resultName: 'Vaso hueco' });
const cap = await llamar('kura_measure_capacity', { objectId: vasoHueco.resultId ?? vasoHueco.id });
const ml = cap.maxCapacityMl ?? cap.capacity?.ml ?? cap.capacityMl;
console.log('  capacidad (mL):', ml);

console.log('\n== Ejemplo 4: caja con esquinas redondeadas ==');
const redonda = await llamar('kura_create_primitive', {
  primitiveType: 'box', name: 'Caja redondeada', placement: 'origin',
  params: { width: 40, depth: 30, height: 20, edgeStyle: 'round', edgeSize: 5, edgeScope: 'vertical' },
});
const esperado = 20 * (40 * 30 - (4 - Math.PI) * 25);
esperar(JSON.stringify(redonda.stats?.dimensionsMm) === JSON.stringify([40, 30, 20]), 'mide 40 × 30 × 20 como la caja recta');
esperar(Math.abs(redonda.stats?.volumeMm3 - esperado) / esperado < 0.002, `volumen ≈ ${Math.round(esperado)} mm³ (obtenido ${redonda.stats?.volumeMm3})`);
const acotada = await llamar('kura_update_primitive_params', { objectId: redonda.id, params: { edgeSize: 40 } });
esperar(acotada.edgeSizeClamped === true && acotada.edgeSizeApplied < 15, `radio acotado a ${acotada.edgeSizeApplied} mm`);

await client.close();
console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nTodos los ejemplos se ejecutaron.');
process.exit(fallos ? 1 : 0);
