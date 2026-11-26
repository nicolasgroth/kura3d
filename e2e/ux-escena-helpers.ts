/**
 * @file e2e/ux-escena-helpers.ts
 * @description Utilidades de los specs `ux-escena-*`: abre la web limpia, expone el store (`__s`) y genera
 * STL de prueba (cubos sueltos) en memoria para importar sin archivos externos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test';
import { enlazarStores } from './store-link';

export const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5217/';

export async function abrir(page: Page): Promise<void> {
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  const discard = page.getByRole('button', { name: 'Descartar' });
  if (await discard.count()) await discard.first().click().catch(() => undefined);
  await enlazarStores(page);
}

/** STL ASCII con un cubo de lado `size` por cada centro (mm, ejes internos x, y, z). */
export function stlCubes(centers: Array<[number, number, number]>, size = 40): string {
  const h = size / 2;
  const lines = ['solid prueba'];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    for (const tri of [[a, b, c], [a, c, d]]) {
      lines.push('facet normal 0 0 0', 'outer loop');
      for (const v of tri) lines.push(`vertex ${v[0]} ${v[1]} ${v[2]}`);
      lines.push('endloop', 'endfacet');
    }
  };
  for (const [cx, cy, cz] of centers) {
    const p = (sx: number, sy: number, sz: number) => [cx + sx * h, cy + sy * h, cz + sz * h];
    quad(p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1));
    quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1));
    quad(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1));
    quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1));
    quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1));
    quad(p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1));
  }
  lines.push('endsolid prueba');
  return lines.join('\n');
}

/** Importa un STL por el selector real de archivos del botón Importar. */
export async function importarStl(page: Page, name: string, content: string | Buffer): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  const fc = await chooser;
  await fc.setFiles({ name, mimeType: 'model/stl', buffer: typeof content === 'string' ? Buffer.from(content) : content });
}

/** Cajas en mundo (Y arriba) de todos los objetos visibles. */
export async function cajas(page: Page): Promise<Array<{ id: string; name: string; min: number[]; max: number[] }>> {
  return page.evaluate(async () => {
    const { worldBox } = await import('/src/core/scene/overlap.ts');
    const s = (window as any).__s.getState();
    return s.objects
      .filter((o: any) => o.visible !== false)
      .map((o: any) => {
        const b = worldBox(o);
        return { id: o.id, name: o.name, min: b!.min.toArray(), max: b!.max.toArray() };
      });
  });
}

/** Pares de objetos cuyas cajas se intersecan (con tolerancia). */
export function solapes(boxes: Array<{ name: string; min: number[]; max: number[] }>, eps = 0.01): string[] {
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if ([0, 1, 2].every((k) => a.min[k] < b.max[k] - eps && a.max[k] > b.min[k] + eps)) out.push(`${a.name} × ${b.name}`);
    }
  return out;
}
