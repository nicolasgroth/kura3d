/**
 * @file e2e/qa25b-torreta-atributos.spec.ts
 * @description QA de la torreta para tornillo y de «Aplicar restas»: la pieza anfitriona (con nombre propio, color,
 * material, grupo, bloqueo de otros atributos) debe quedar como UNA sola pieza conservando todos sus atributos
 * (todo salvo malla, estadísticas y transformaciones derivadas), también con la pieza girada y dentro de un grupo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir as abrirBase, aPixel } from './qa12-helpers';
import { cajas } from './ux-escena-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25b';
async function abrir(page: Page): Promise<string[]> {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`console.error: ${m.text()}`); });
  await abrirBase(page);
  return errs;
}
const cuadros = (page: Page, n = 2) => page.evaluate(async (k) => {
  for (let i = 0; i < k; i += 1) await new Promise<void>((r) => requestAnimationFrame(() => r()));
}, n);
const libre = (page: Page) => expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 20_000 }).toBeNull();

/** Atributos del objeto sin la geometría. */
const atributos = (page: Page, id: string) => page.evaluate((i) => {
  const o = (window as any).__s.getState().objects.find((x: any) => x.id === i);
  if (!o) return null;
  const { mesh, stats, ...resto } = o;
  return JSON.parse(JSON.stringify(resto));
}, id);

async function vista(page: Page) {
  await page.evaluate(() => {
    const r = (window as any).__r3f.getState();
    r.camera.position.set(60, 70, 80); r.camera.lookAt(0, 15, 0); r.camera.updateMatrixWorld();
    r.controls?.target?.set?.(0, 15, 0); r.controls?.update?.();
  });
  await cuadros(page);
}

for (const caso of [{ nombre: 'simple', rot: false, grupo: false }, { nombre: 'en grupo y girada en Y', rot: true, grupo: true }]) {
  test(`torreta + aplicar restas conserva atributos de la pieza (${caso.nombre})`, async ({ page }) => {
    test.setTimeout(120_000);
    const errs = await abrir(page);
    const hostId = await page.evaluate(async ({ rot, grupo }) => {
      const s = () => (window as any).__s.getState();
      const o = await s().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0], name: 'Mi tapa especial', color: '#ff3366' });
      const o2 = await s().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { position: [80, 0, 0], name: 'Compañera' });
      
      (window as any).__s.setState({ objects: s().objects.map((x: any) => (x.id === o.id ? { ...x, materialPreset: 'abs', ...(rot ? { rotation: [0, 0.5, 0] } : {}) } : x)) });
      if (grupo) { s().setSelection([o.id, o2.id]); s().groupObjects(); }
      s().setSelection([]);
      s().dismissAllToasts?.();
      return o.id as string;
    }, caso);
        await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), hostId);
    const antes = await atributos(page, hostId);
    const caja0 = (await cajas(page)).find((c) => c.id === hostId)!;
    await vista(page);
    await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
    await page.getByRole('menuitem', { name: /^Torreta para tornillo/ }).click();
    const top = await aPixel(page, [0, 30, 0]);
    await page.mouse.move(top.x - 4, top.y - 4);
    await page.mouse.move(top.x, top.y, { steps: 3 });
    await cuadros(page);
    await page.mouse.down(); await page.mouse.up();
    await libre(page);
    await page.getByTestId('turret-done').click();
    const nObjs = await page.evaluate(() => (window as any).__s.getState().objects.length);
    await page.evaluate(async () => { const x = (window as any).__s.getState(); x.setSelection([]); await x.applyHolesOnSolids(); });
    await libre(page);
    const estado = await page.evaluate(() => {
      const s = (window as any).__s.getState();
      return { n: s.objects.length, noms: s.objects.map((o: any) => o.name), sel: s.selectedIds, groups: JSON.stringify(s.groups ?? null) };
    });
    console.log('QA25B torreta', caso.nombre, `objs tras añadir=${nObjs}`, JSON.stringify(estado));
    await page.screenshot({ path: `${EV}/torreta-${caso.grupo ? 'grupo' : 'simple'}.png` });
    const idDespues = await page.evaluate((nombre) => (window as any).__s.getState().objects.find((o: any) => o.name === nombre)?.id ?? null, 'Mi tapa especial');
    expect(idDespues, 'la pieza debe conservar su nombre').not.toBeNull();
    const caja1 = (await cajas(page)).find((c) => c.id === idDespues)!;
    console.log('QA25B caja', caso.nombre, JSON.stringify(caja0.min.map((v) => +v.toFixed(2))), JSON.stringify(caja0.max.map((v) => +v.toFixed(2))), '->', JSON.stringify(caja1.min.map((v) => +v.toFixed(2))), JSON.stringify(caja1.max.map((v) => +v.toFixed(2))));
    // El poste sube (Y mundo +): la caja solo crece por arriba, mismo plano de base y laterales aproximados.
    expect(caja1.min[1]).toBeCloseTo(caja0.min[1], 1);
    expect(caja1.max[1]).toBeGreaterThan(caja0.max[1] + 5);
    const grupoMiembros = await page.evaluate((id) => {
      const st = (window as any).__s.getState();
      const g = st.objects.find((o: any) => o.id === id)?.groupRef;
      return g ? st.objects.filter((o: any) => o.groupRef === g).map((o: any) => o.name) : null;
    }, idDespues);
    console.log('QA25B grupo', caso.nombre, JSON.stringify(grupoMiembros));
    const despues = await atributos(page, idDespues);
    const difs: string[] = [];
    for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
      if (['id', 'position', 'rotation', 'scale', 'groupRef', 'metadata', 'source', 'primitiveType', 'primitiveParams', 'parametric'].includes(k)) continue;
      if (JSON.stringify(antes[k]) !== JSON.stringify(despues[k])) difs.push(`${k}: ${JSON.stringify(antes[k])} -> ${JSON.stringify(despues[k])}`);
    }
    console.log('QA25B torreta difs', caso.nombre, JSON.stringify(difs), 'id igual:', idDespues === hostId);
    expect(difs, difs.join('\n')).toEqual([]);
    expect(estado.n).toBe(2);
    expect(errs, errs.join(' / ')).toEqual([]);
  });
}
