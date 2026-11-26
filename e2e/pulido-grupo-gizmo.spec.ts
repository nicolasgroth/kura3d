/**
 * @file e2e/pulido-grupo-gizmo.spec.ts
 * @description Manipulador de un grupo con arrastre real del ratón: los 7 puntos de agarre de la escala
 * (ejes X, Y, Z, planos XY, YZ, XZ y el centro) responden y escalan el grupo como bloque; girar 10° sobre un eje
 * horizontal NO re-apoya (igual que un objeto suelto) pero el aviso «Fuera de volumen» se muestra para el grupo.
 * Los agarres se ubican proyectando los selectores internos de TransformControls a píxeles de pantalla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './qa12-helpers';

async function grupoDeDosCubos(page: Page, modo: 'rotate' | 'scale') {
  await abrir(page);
  await page.evaluate(async (modoGizmo) => {
    const w = window as any;
    const s = () => w.__s.getState();
    s().createStarterCube();
    await new Promise((r) => setTimeout(r, 400));
    s().createStarterCube();
    await new Promise((r) => setTimeout(r, 400));
    const [a, b] = s().objects;
    s().setObjectTransform(b.id, { position: [50, b.position[1], 0] }, true);
    s().groupObjects([a.id, b.id], 'Par');
    s().selectGroup(s().groups[0].id);
    s().setActiveTool('select');
    s().setTransformMode(modoGizmo);
    // Los avisos «Creado…» viven en la esquina del visor y, en ventanas bajas, tapan un agarre del manipulador.
    s().dismissAllToasts();
    await new Promise((r) => setTimeout(r, 600));
  }, modo);
}

/** Píxel de pantalla de cada selector del manipulador (nombre → [x, y]) y del pivote. */
async function agarres(page: Page) {
  return page.evaluate(() => {
    const st = (window as any).__r3f.getState();
    let g: any = null;
    st.scene.traverse((o: any) => { if (o.constructor?.name === 'TransformControlsGizmo') g = o; });
    const cam = st.camera;
    cam.updateMatrixWorld();
    const r = st.gl.domElement.getBoundingClientRect();
    const pix = (v: any) => { const p = v.clone().project(cam); return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]; };
    const picker = g.picker[g.mode];
    picker.updateWorldMatrix(true, true);
    const out: Record<string, number[]> = {};
    for (const m of picker.children) {
      m.geometry.computeBoundingSphere();
      out[m.name] = pix(m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld));
    }
    const pivot = pix(g.parent.object.position.clone());
    return { out, pivot };
  });
}

const escalas = (page: Page) => page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.scale[0]));

test('escala del grupo: los 7 puntos de agarre responden al arrastre real', async ({ page }) => {
  await grupoDeDosCubos(page, 'scale');
  const nombres: Array<[string, string]> = [['X', 'X'], ['Y', 'Y'], ['Z', 'Z'], ['XY', 'XY'], ['YZ', 'YZ'], ['XZ', 'XZ'], ['centro', 'XYZX']];
  for (const [etiqueta, nombre] of nombres) {
    // Gizmo listo: la posición del agarre es estable en dos lecturas seguidas (sin esperas fijas).
    let previo: number[] | null = null;
    await expect.poll(async () => {
      const lectura = (await agarres(page)).out[nombre];
      const estable = Boolean(lectura) && previo !== null && Math.hypot(lectura[0] - previo[0], lectura[1] - previo[1]) < 0.5;
      previo = lectura ?? null;
      return estable;
    }, { message: `agarre ${etiqueta} estable` }).toBe(true);
    const { out, pivot } = await agarres(page);
    const [x, y] = out[nombre];
    const dx = x - pivot[0], dy = y - pivot[1];
    const len = Math.hypot(dx, dy) || 1;
    const antes = await escalas(page);
    await page.mouse.move(x, y);
    // Con el puntero sobre el agarre, el manipulador resalta su selector antes de aceptar el arrastre.
    await expect.poll(() => page.evaluate(() => {
      const st = (window as any).__r3f.getState();
      let g: any = null;
      st.scene.traverse((o: any) => { if (o.constructor?.name === 'TransformControlsGizmo') g = o; });
      return Boolean(g?.parent?.axis);
    }), { message: `puntero sobre el agarre ${etiqueta}` }).toBe(true);
    await page.mouse.down();
    await page.mouse.move(x + (dx / len) * 25, y + (dy / len) * 25, { steps: 5 });
    await page.mouse.move(x + (dx / len) * 60, y + (dy / len) * 60, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await escalas(page))[0], { message: `agarre ${etiqueta}: el grupo debe escalar` }).not.toBeCloseTo(antes[0], 3);
    const despues = await escalas(page);
    expect(despues[1]).toBeCloseTo(despues[0], 6); // bloque rígido: ambos miembros con el mismo factor
    await page.keyboard.press('Control+z'); // un arrastre = un paso de deshacer
    await expect.poll(() => escalas(page)).toEqual(antes);
  }
});

test('girar un grupo 10°: no se re-apoya (como un objeto suelto) y avisa «Fuera de volumen»', async ({ page }) => {
  await grupoDeDosCubos(page, 'rotate');
  // Referencia: un objeto suelto girado 10° tampoco se re-apoya (su altura no cambia).
  const suelto = await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.createStarterCube();
    const o = (window as any).__s.getState().objects.at(-1);
    const y0 = o.position[1];
    (window as any).__s.getState().setObjectTransform(o.id, { rotation: [(10 * Math.PI) / 180, 0, 0] }, true);
    const y1 = (window as any).__s.getState().objects.at(-1).position[1];
    (window as any).__s.getState().deleteObjects([o.id]);
    return [y0, y1];
  });
  expect(suelto[1]).toBe(suelto[0]);
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.selectGroup(s.groups[0].id);
    s.transformSelectionRigid({ rotation: [(10 * Math.PI) / 180, 0, 0] }, { recordHistory: true });
  });
  const minY = await page.evaluate(() => {
    const w = window as any;
    const cam = w.__r3f.getState().camera;
    const Q = cam.quaternion.constructor, E = cam.rotation.constructor, V = cam.position.constructor;
    let m = Infinity;
    for (const o of w.__s.getState().objects) {
      const q = new Q().setFromEuler(new E(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ'));
      const P = o.mesh.positions;
      for (let i = 0; i < P.length; i += 3) {
        const v = new V(P[i] * o.scale[0], P[i + 1] * o.scale[1], P[i + 2] * o.scale[2]).applyQuaternion(q);
        m = Math.min(m, v.y + o.position[1]);
      }
    }
    return m;
  });
  expect(minY).toBeLessThan(-0.5);
  await expect(page.getByText('Fuera de volumen')).toBeVisible();
});
