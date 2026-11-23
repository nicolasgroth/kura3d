/**
 * @file e2e/pulido7-dividir-pegar.spec.ts
 * @description Dividir: «uniones para pegar» es una sola cifra. Tras dividir un cubo de 440 mm, se marcan como corte liso
 * la mayoría de las uniones (y 2 como pegadas por el motor para poder montar) y la cabecera de la sección, la lista de
 * avisos repetidos y el aviso del motor dan el mismo número de uniones para pegar, sobre el mismo total.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, dividirCubo, SHOTS } from './ux4-helpers';

test('cabecera, lista y aviso cuentan las mismas uniones para pegar', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, 1440, 900);
  await dividirCubo(page);
  const cifras = await page.evaluate(() => {
    const st = (window as any).__s;
    const objs = st.getState().objects.filter((o: any) => o.metadata?.split);
    const groupId = objs[0].metadata.split.groupId;
    const labels = [...new Set(objs.flatMap((o: any) => (o.metadata.split.joints ?? []).map((j: any) => j.label)))] as string[];
    // Todas menos 3 pasan a corte liso; 2 de ellas las "pegó" el motor para poder montar
    const glue = new Set(labels.slice(0, Math.max(4, labels.length - 3)));
    const fixed = labels.slice(0, 2);
    st.setState({
      objects: st.getState().objects.map((o: any) => !o.metadata?.split ? o : {
        ...o,
        metadata: { ...o.metadata, split: { ...o.metadata.split, joints: (o.metadata.split.joints ?? []).map((j: any) => glue.has(j.label) ? { ...j, kind: 'glue' } : j) } },
      }),
      splitNotes: { ...st.getState().splitNotes, [groupId]: { warnings: [], suggestions: [], weakJoints: [], gluedByFix: fixed, changedByFix: [] } },
    });
    // Cifra esperada: uniones de corte liso (las ya lisas de origen y las marcadas) sobre el total
    const lisas = new Set<string>(glue);
    for (const o of st.getState().objects) for (const j of o.metadata?.split?.joints ?? []) if (j.kind === 'glue') lisas.add(j.label);
    return { glue: lisas.size, total: labels.length };
  });
  expect(cifras.glue).toBeGreaterThan(2);
  const seccion = page.locator('#kura-split-joints');
  const cabecera = page.getByTestId('split-assembly-status');
  await expect(cabecera).toContainText(`dejó ${cifras.glue} de ${cifras.total} uniones para pegar (2 por impedir el montaje)`);
  const comun = page.getByTestId('split-common-notes');
  await expect(comun).toContainText(`afecta a ${cifras.glue} uniones`);
  await seccion.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS.replace('ux4', 'pulido7')}/dividir-pegar-cifras.png` });
});
