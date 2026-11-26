/**
 * @file e2e/reales-ui-borrador.spec.ts
 * @description Borrador automático con escenas pesadas (malla sintética de 1,2 M de triángulos en
 * IndexedDB real de Chromium): se escribe, mover el objeto no reescribe la malla, recuperar tras
 * recargar restaura todo, y con la cuota del navegador simulada insuficiente el pie dice el motivo con
 * sus cifras y ofrece "Guardar proyecto ahora". Ejecuta con
 * `KURA_URL=http://127.0.0.1:5234/ npm run test:e2e -- reales-ui-borrador`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5234/';
const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/reales-ui';

async function listo(page: Page) {
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => {
    (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore;
  });
}

/** Agrega por el store un objeto con una rejilla de ~2·n² triángulos (malla abierta, sintética). */
async function escenaPesada(page: Page, n = 775) {
  await page.evaluate(async (n) => {
    const { computeMeshStats } = await import('/src/engine/primitives.ts');
    const positions = new Float32Array((n + 1) * (n + 1) * 3);
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const k = (i * (n + 1) + j) * 3;
      positions[k] = i * 0.2; positions[k + 1] = Math.sin(i * 0.05) * 2 + 2; positions[k + 2] = j * 0.2;
    }
    const indices = new Uint32Array(n * n * 6);
    let t = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j, b = a + 1, c = a + n + 1, d = c + 1;
      indices.set([a, c, b, b, c, d], t); t += 6;
    }
    const mesh = { positions, indices };
    const s = (window as any).__s;
    s.getState().pushHistory?.();
    s.setState((st: any) => ({
      objects: [...st.objects, {
        id: 'pesado', name: 'Rejilla pesada', source: 'imported', position: [-77, 0, -77], rotation: [0, 0, 0],
        scale: [1, 1, 1], color: '#3388cc', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
      }],
    }));
  }, n);
}

/** Bloques de geometría guardados (clave → momento de escritura) y borradores en IndexedDB. */
async function idb(page: Page) {
  return page.evaluate(() => new Promise<{ blocks: Record<string, number>; drafts: number; manifests: number }>((resolve, reject) => {
    const req = indexedDB.open('kura3d-project-recovery');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['meshBlocks', 'drafts', 'draftManifests'], 'readonly');
      const blocks: Record<string, number> = {};
      const cur = tx.objectStore('meshBlocks').openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { blocks[String(c.key)] = c.value.writtenAt; c.continue(); }
      };
      const drafts = tx.objectStore('drafts').count();
      const manifests = tx.objectStore('draftManifests').count();
      tx.oncomplete = () => { db.close(); resolve({ blocks, drafts: drafts.result, manifests: manifests.result }); };
    };
  }));
}

test('escena de 1,2 M de triángulos: el borrador se escribe, mover no reescribe la malla y se recupera', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(URL);
  await listo(page);
  await escenaPesada(page);
  const footer = page.locator('footer');
  await expect(footer).toContainText('Borrador local guardado', { timeout: 60000 });
  const first = await idb(page);
  const keys = Object.keys(first.blocks);
  expect(keys.length).toBeGreaterThanOrEqual(2);
  expect(first.manifests).toBe(1);

  // Mover y recolorear: el borrador se reescribe, pero los bloques de la malla son los mismos.
  await page.evaluate(() => {
    const s = (window as any).__s;
    s.setState((st: any) => ({ objects: st.objects.map((o: any) => ({ ...o, position: [10, 0, 5], color: '#cc3333' })) }));
  });
  await expect(footer).toContainText('Guardando borrador', { timeout: 10000 }).catch(() => undefined);
  await expect(footer).toContainText('Borrador local guardado', { timeout: 60000 });
  const second = await idb(page);
  for (const key of keys) expect(second.blocks[key]).toBe(first.blocks[key]);
  expect(Object.keys(second.blocks).length).toBe(keys.length);
  await page.screenshot({ path: `${SHOTS}/borrador-guardado.png` });

  // Recargar (sin guardar) y recuperar el borrador desde el aviso.
  page.on('dialog', (d) => void d.accept());
  await page.reload();
  await listo(page);
  await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Recuperar', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => {
    const o = (window as any).__s.getState().objects.find((x: any) => x.name === 'Rejilla pesada');
    return o ? [o.stats.triangles, o.position[0], o.color] : null;
  }), { timeout: 60000 }).toEqual([775 * 775 * 2, 10, '#cc3333']);
});

test('cuota del navegador insuficiente: el pie explica el motivo y ofrece guardar el proyecto', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const fake = { estimate: async () => ({ usage: 2_000_000, quota: 12_000_000 }), persisted: async () => false };
    Object.defineProperty(navigator, 'storage', { configurable: true, get: () => fake });
  });
  await page.goto(URL);
  await listo(page);
  await escenaPesada(page);
  const notice = page.getByTestId('recovery-unavailable');
  await expect(notice).toBeVisible({ timeout: 60000 });
  await expect(notice).toContainText('no cabe en el espacio que da el navegador');
  // Cifras con coma decimal del español: necesita ~21,6 MB, quedan 8,8 MB.
  await expect(notice).toContainText(/\d+ MB de 8,8 MB libres/);
  const save = notice.getByRole('button', { name: 'Guardar proyecto ahora' });
  await expect(save).toBeVisible();
  await expect(save).toHaveAttribute('title', /\.kura/);
  await save.focus();
  await expect(save).toBeFocused();
  await page.screenshot({ path: `${SHOTS}/borrador-cuota-1280.png` });
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(save).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/borrador-cuota-1024.png` });
});
