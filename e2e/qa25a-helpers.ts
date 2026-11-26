/**
 * @file e2e/qa25a-helpers.ts
 * @description Ayudantes de las pruebas de QA del lote 25-nov (Suavizar, Orientar, barra flotante): abre la web,
 * crea una esfera con ruido, mide volumen/pasos de historial y recoge errores de consola.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, type Page } from '@playwright/test';
import { abrir as abrirBase } from './ux-escena-helpers';

export const EVID = 'G:/proyectos/kura3d/.eval-tmp/qa25a';

/** Abre la web y registra errores de consola/página (se leen con `errores(page)`). */
export async function abrir(page: Page): Promise<string[]> {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console.error: ${m.text()}`);
  });
  await abrirBase(page);
  await page.evaluate(() => {
    try { localStorage.removeItem('kura3d-floating-bar'); } catch { /* sin storage */ }
  });
  return errs;
}

export async function cmd(page: Page, command: string, params: Record<string, unknown> = {}): Promise<any> {
  const r = await page.evaluate(
    async ([c, p]) => (window as any).__s.getState().executeCommand({ id: `qa-${Math.random()}`, command: c, params: p }),
    [command, params] as const,
  );
  if (!r.ok) throw new Error(`${command}: ${JSON.stringify(r).slice(0, 400)}`);
  return r.result;
}

/** Esfera con ruido radial determinista (como un escaneo). Devuelve el id. */
export async function esferaRuidosa(page: Page, radio = 25, ruido = 0.8): Promise<string> {
  const e = await cmd(page, 'create_primitive', { type: 'sphere', radius: radio, name: 'Escaneo', position: [0, 0, 0], color: '#38bdf8' });
  await page.evaluate(([id, amp]) => {
    const s = (window as any).__s;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const objects = s.getState().objects.map((o: any) => {
      if (o.id !== id) return o;
      const p = o.mesh.positions.slice();
      for (let i = 0; i < p.length; i += 3) {
        const l = Math.hypot(p[i], p[i + 1], p[i + 2]) || 1;
        const k = 1 + ((rnd() * 2 - 1) * (amp as number)) / l;
        p[i] *= k; p[i + 1] *= k; p[i + 2] *= k;
      }
      return { ...o, mesh: { ...o.mesh, positions: p } };
    });
    s.setState({ objects });
  }, [e.id, ruido] as const);
  return e.id;
}

export const pasos = (page: Page) => page.evaluate(() => (window as any).__s.getState().past.length as number);

export const volumen = (page: Page, id: string) =>
  page.evaluate(async (oid) => {
    const { signedMeshVolume } = await import('/src/core/addons/revolveMesh.ts');
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === oid);
    return Math.abs(signedMeshVolume(o.mesh.positions, o.mesh.indices)) as number;
  }, id);

export const libre = (page: Page) =>
  expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 60_000 }).toBeNull();

export async function seleccionar(page: Page, ids: string[]): Promise<void> {
  await page.evaluate((i) => (window as any).__s.setState({ selectedIds: i }), ids);
}

/** Texto crudo tipo clave de i18n visible (p. ej. `smooth.intensity.help`). */
export async function clavesCrudas(page: Page, selector: string): Promise<string[]> {
  const txt = await page.locator(selector).innerText();
  return txt.match(/\b[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){2,}\b/g) ?? [];
}

export async function idioma(page: Page, lang: string): Promise<void> {
  await page.evaluate((l) => (window as any).__s.getState().setLanguage?.(l) ?? (window as any).__s.setState({ language: l }), lang);
}
