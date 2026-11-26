/**
 * @file scripts/docs-comprobar-enlaces.mjs
 * @description Comprueba que todos los enlaces e imágenes relativos de `README.md`, `docs/guia/**` y
 * `docs/MCP.md` apunten a archivos que existen (y que no queden PNG sin usar en `docs/guia/img/`).
 * Uso: `npm run docs:enlaces`. Sale con código 1 si encuentra algún enlace roto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function listar(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = resolve(dir, n);
    return statSync(p).isDirectory() ? listar(p) : [p];
  });
}

const docs = [
  resolve(raiz, 'README.md'),
  resolve(raiz, 'docs/MCP.md'),
  ...listar(resolve(raiz, 'docs/guia')).filter((f) => f.endsWith('.md')),
].filter(existsSync);

const rotos = [];
const usadas = new Set();
const RE = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<img[^>]+src="([^"]+)"/g;

for (const doc of docs) {
  const texto = readFileSync(doc, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const m of texto.matchAll(RE)) {
    const ref = (m[1] ?? m[2] ?? '').trim();
    if (!ref || /^(https?:|mailto:|#)/.test(ref)) continue;
    const ruta = decodeURIComponent(ref.split('#')[0]);
    if (!ruta) continue;
    const destino = resolve(dirname(doc), ruta);
    usadas.add(destino);
    if (!existsSync(destino)) rotos.push(`${relative(raiz, doc)} → ${ref}`);
  }
}

const sinUsar = listar(resolve(raiz, 'docs/guia/img'))
  .filter((f) => /\.(png|webm|gif)$/.test(f) && !usadas.has(f))
  .map((f) => relative(raiz, f));

console.log(`Documentos revisados: ${docs.length}. Enlaces rotos: ${rotos.length}. Imágenes sin usar: ${sinUsar.length}.`);
for (const r of rotos) console.error(`ROTO  ${r}`);
for (const s of sinUsar) console.warn(`SIN USAR  ${s}`);
process.exit(rotos.length ? 1 : 0);
