/**
 * @file e2e/docs/helpers.ts
 * @description Utilidades del generador de capturas de la documentación pública: abre la web limpia en
 * español y tema claro, arma escenas con primitivas de la propia app (nunca modelos de terceros) por el
 * bus de comandos y guarda PNG en `docs/guia/img/<guia>-<paso>.png`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { statSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { enlazarStores } from '../store-link';

export const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5239/';
export const IMG_DIR = path.resolve(process.cwd(), 'docs/guia/img');
mkdirSync(IMG_DIR, { recursive: true });

export interface Clip { x: number; y: number; width: number; height: number }

/** Abre la web sin proyecto previo, con el motor listo y el consejo de la barra inferior oculto. */
export async function abrir(page: Page): Promise<void> {
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 90_000 });
  await enlazarStores(page, { medicion: true });
  await page.evaluate(async () => {
    // Cámara del visor (módulo `_roots` de react-three-fiber) para proyectar puntos del mundo a píxeles.
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    for (const u of urls) {
      const m = await import(/* @vite-ignore */ u);
      if (m._roots) (window as any).__r3f = [...m._roots.values()][0].store;
    }
  });
  const tip = page.getByRole('button', { name: 'Ocultar consejo' });
  if (await tip.count()) await tip.first().click();
  await page.mouse.move(700, 880);
}

/** Ejecuta un comando del bus (los mismos que usa el servidor MCP) con ejes de usuario (Z arriba). */
export async function cmd(page: Page, command: string, params: Record<string, unknown> = {}): Promise<any> {
  const r = await page.evaluate(
    async ([c, p]) => (window as any).__s.getState().executeCommand({ id: `docs-${Math.random()}`, command: c, params: p }),
    [command, params] as const,
  );
  if (!r.ok) throw new Error(`${command}: ${JSON.stringify(r).slice(0, 400)}`);
  return r.result;
}

/** Selecciona objetos por id. */
export async function seleccionar(page: Page, ids: string[]): Promise<void> {
  await page.evaluate((i) => (window as any).__s.setState({ selectedIds: i }), ids);
}

/** Encuadra la escena entera (o la selección) y espera a que la cámara se asiente. */
export async function encuadrar(page: Page, preset: 'fit' | 'scene' | 'iso' = 'scene'): Promise<void> {
  await page.evaluate((p) => (window as any).__s.getState().requestCameraPreset(p), preset);
  await page.waitForTimeout(900);
}

/** Cierra los avisos flotantes para que no tapen lo que se explica. */
export async function sinAvisos(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__s?.setState({ toasts: [] }));
  await page.waitForTimeout(200);
}

/** Importa un STL en memoria por el selector real del botón Importar. */
export async function importarArchivo(page: Page, name: string, content: string | Buffer, mimeType = 'model/stl'): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  const fc = await chooser;
  await fc.setFiles({ name, mimeType, buffer: typeof content === 'string' ? Buffer.from(content) : content });
}

/** STL ASCII con un cubo de lado `size` por centro; `sinCara` deja un agujero (malla abierta). */
export function stlCubos(centros: Array<[number, number, number]>, size: number, sinCara = false): string {
  const h = size / 2;
  const lines = ['solid ejemplo'];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    for (const tri of [[a, b, c], [a, c, d]]) {
      lines.push('facet normal 0 0 0', 'outer loop');
      for (const v of tri) lines.push(`vertex ${v[0]} ${v[1]} ${v[2]}`);
      lines.push('endloop', 'endfacet');
    }
  };
  for (const [cx, cy, cz] of centros) {
    const p = (sx: number, sy: number, sz: number) => [cx + sx * h, cy + sy * h, cz + sz * h];
    quad(p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1));
    if (!sinCara) quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1));
    quad(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1));
    quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1));
    quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1));
    quad(p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1));
  }
  lines.push('endsolid ejemplo');
  return lines.join('\n');
}

/** Caja del objeto en el mundo (ejes internos, Y arriba). */
export async function cajaMundo(page: Page, id: string): Promise<{ min: number[]; max: number[] }> {
  return page.evaluate(async (oid) => {
    const { worldBox } = await import('/src/core/scene/overlap.ts');
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === oid);
    const b = worldBox(o)!;
    return { min: b.min.toArray(), max: b.max.toArray() };
  }, id);
}

/** Clic real del ratón sobre un punto del mundo (ejes internos, Y arriba). */
export async function clicMundo(page: Page, p: [number, number, number]): Promise<void> {
  const px = await page.evaluate((pt) => {
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const v = new cam.position.constructor(pt[0], pt[1], pt[2]).project(cam);
    const r = st.gl.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }, p);
  await page.mouse.move(px.x - 3, px.y - 3);
  await page.mouse.move(px.x, px.y, { steps: 3 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);
}

/** Guarda una captura: ventana completa, un recorte o un elemento. Avisa si pesa más de ~300 KB. */
export async function captura(page: Page, nombre: string, area?: Clip | Locator): Promise<void> {
  const file = path.join(IMG_DIR, `${nombre}.png`);
  await sinAvisos(page);
  await page.mouse.move(720, 890);
  // Un tooltip de foco o de cursor (p. ej. el de «Volver», que cae justo donde estaba el menú) tarda en irse.
  await page.waitForTimeout(500);
  if (area && 'screenshot' in area) await area.screenshot({ path: file });
  else await page.screenshot({ path: file, clip: area as Clip | undefined });
  const kb = Math.round(statSync(file).size / 1024);
  if (kb > 500) console.warn(`AVISO: ${nombre}.png pesa ${kb} KB (> 500 KB)`);
}
