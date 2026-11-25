/**
 * @file e2e/qa25e-usab-c.spec.ts
 * @description QA 25-nov (E) del lote de usabilidad C, en tema claro y oscuro: los atajos Mayús+C, Mayús+M, D y C no dejan
 * una letra escrita en el primer campo del panel; Orientar con una figura orgánica (grupo plegado «No recomendadas»,
 * Enter sobre una de ellas no aplica y lleva a «Aplicar de todos modos», estado visible = región role=status, también
 * tras aplicar); sin claves crudas ni «Kura3D». Evidencia en `.eval-tmp/qa25e/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd, esferaRuidosa, libre, pasos, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25e';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

async function tema(page: Page, esquema: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: esquema });
  await S(page, (s) => s.setColorScheme('system'));
  await page.evaluate((e) => (window as any).__s.getState().setColorScheme(e), esquema);
  await page.waitForTimeout(300);
}

const crudas = (txt: string) => txt.match(/\b[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,}\b/g)?.filter((k) => /^(orient|split|plates|simplify|smooth|measure|cut|mold|ux|dialog)\./.test(k)) ?? [];

for (const esquema of ['light', 'dark'] as const) {
  test.describe(`usabilidad C (${esquema})`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('atajos de herramientas no dejan una letra en el primer campo del panel', async ({ page }) => {
      const errs = await abrir(page);
      await tema(page, esquema);
      const id = (await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 40, name: 'Caja' })).id as string;
      const teclas: Array<[string, string]> = [['Shift+C', 'dividir'], ['Shift+M', 'molde'], ['d', 'medir'], ['c', 'corte']];
      const informe: string[] = [];
      for (const [tecla, nombre] of teclas) {
        await seleccionar(page, [id]);
        await page.locator('body').click({ position: { x: 3, y: 3 } }).catch(() => undefined);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.keyboard.press(tecla);
        await page.waitForTimeout(900);
        const r = await page.evaluate(() => {
          const panel = document.querySelector('[data-testid$="-panel"], .kura-op-panel, aside [role="region"]') as HTMLElement | null;
          const campos = Array.from(document.querySelectorAll('input:not([type=radio]):not([type=checkbox]), textarea')) as HTMLInputElement[];
          const sospechosos = campos.filter((c) => /^[a-zA-Z]$/.test(c.value.trim())).map((c) => `${c.getAttribute('aria-label') ?? c.name ?? c.id}="${c.value}"`);
          const a = document.activeElement as HTMLInputElement | null;
          return { panel: panel?.getAttribute('data-testid') ?? panel?.className ?? null, sospechosos, activo: a ? `${a.tagName}:${a.getAttribute('aria-label') ?? a.id}=${a.value ?? ''}` : null };
        });
        informe.push(`${tecla}/${nombre}: ${JSON.stringify(r)}`);
        await page.screenshot({ path: `${EV}/atajo-${nombre}-${esquema}.png` });
        expect(r.sospechosos, `${tecla}: letra escrita en un campo`).toEqual([]);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
        await libre(page);
      }
      console.log('QA25E atajos', esquema, '\n' + informe.join('\n'));
      expect(errs, errs.join('\n')).toEqual([]);
    });

    test('Orientar con figura orgánica: grupo plegado, Enter no aplica, estado coherente con role=status', async ({ page }) => {
      test.setTimeout(180_000);
      const errs = await abrir(page);
      await tema(page, esquema);
      const id = await esferaRuidosa(page, 25, 1.2);
      await seleccionar(page, [id]);
      await S(page, (s) => s.dismissAllToasts?.());
      const { itemAccion } = await import('./acciones-helpers');
      const p0 = await pasos(page);
      await (await itemAccion(page, 'Orientar para imprimir…')).click();
      const panel = page.getByTestId('orient-panel');
      await expect(panel).toBeVisible();
      await expect(page.getByTestId('orient-option').first()).toBeVisible({ timeout: 90_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${EV}/orientar-${esquema}.png` });
      const grupo = page.getByTestId('orient-nobase-group');
      console.log('QA25E orientar grupo count', await grupo.count(), await grupo.first().innerText().catch(() => ''));
      expect(await grupo.count(), 'grupo «No recomendadas» presente').toBeGreaterThan(0);
      const txtGrupo = (await grupo.first().innerText()).replace(/\s+/g, ' ');
      expect(txtGrupo).toMatch(/No recomendadas: sin base de apoyo \(\d+\)/);
      // Plegado: el grupo es el último bloque de la lista y sus opciones no son visibles.
      const abierto = await page.evaluate(() => {
        const g = document.querySelector('[data-testid="orient-nobase-group"]') as HTMLElement | null;
        const det = g?.closest('details') ?? g?.querySelector('details');
        return { esDetails: Boolean(det), open: (det as HTMLDetailsElement | null)?.open ?? null, expanded: g?.getAttribute('aria-expanded') ?? g?.querySelector('[aria-expanded]')?.getAttribute('aria-expanded') ?? null };
      });
      console.log('QA25E plegado', JSON.stringify(abierto));
      const sinBase = page.getByTestId('orient-options-nobase');
      const nVisibles = (await sinBase.getByTestId('orient-option').first().isVisible()) ? 1 : 0;
      console.log('QA25E opciones sin base visibles al abrir:', nVisibles);
      expect(nVisibles, 'el grupo debe empezar plegado').toBe(0);
      // Estado visible vs región status.
      const estado = async () => ({
        visible: (await page.getByTestId('orient-status').first().innerText().catch(() => '')).replace(/\s+/g, ' '),
        live: (await page.locator('[role="status"]').allInnerTexts()).join(' | ').replace(/\s+/g, ' '),
      });
      console.log('QA25E estado inicial', JSON.stringify(await estado()));
      // Abrir el grupo y probar Enter sobre una no recomendada.
      await grupo.first().click();
      await page.waitForTimeout(500);
      const opt = sinBase.getByTestId('orient-option').first();
      await expect(opt).toBeVisible();
      await opt.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${EV}/orientar-nobase-${esquema}.png` });
      await opt.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200);
      const tras = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return { tag: a?.tagName, texto: a?.innerText?.replace(/\s+/g, ' ').slice(0, 60), testid: a?.getAttribute('data-testid') }; });
      console.log('QA25E foco tras Enter en no recomendada', JSON.stringify(tras), 'pasos', await pasos(page), 'vs', p0);
      expect(await pasos(page), 'Enter sobre una no recomendada no debe aplicar').toBe(p0);
      expect(JSON.stringify(tras)).toMatch(/de todos modos|Aplicar|nobase|confirm/i);
      // Aplicar de todos modos.
      const forzar = page.getByRole('button', { name: /Aplicar de todos modos/ });
      await expect(forzar).toBeVisible();
      await page.screenshot({ path: `${EV}/orientar-forzar-${esquema}.png` });
      await forzar.click();
      await expect.poll(() => pasos(page), { timeout: 30_000 }).toBe(p0 + 1);
      await libre(page);
      await page.waitForTimeout(800);
      const fin = await estado();
      console.log('QA25E estado tras aplicar', JSON.stringify(fin));
      await page.screenshot({ path: `${EV}/orientar-aplicado-${esquema}.png` });
      if (fin.visible) expect(fin.live, 'el estado visible debe coincidir con lo anunciado').toContain(fin.visible.slice(0, 30));
      const cuerpo = await page.evaluate(() => document.body.innerText);
      expect(crudas(cuerpo)).toEqual([]);
      expect(cuerpo).not.toMatch(/Kura3D/);
      expect(errs, errs.join('\n')).toEqual([]);
    });
  });
}
