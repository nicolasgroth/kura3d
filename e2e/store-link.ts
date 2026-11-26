/**
 * @file e2e/store-link.ts
 * @description Enlaza `window.__s` (y `window.__m` con `medicion`) con las instancias de los stores que usa la app.
 * Si Vite sirvió el módulo con `?t=…` (tras una recarga en caliente), un `import('/src/store/useKuraStore.ts')` sin
 * la marca crea un segundo store y los specs leerían un estado ajeno; aquí se importa la URL exacta que cargó la página.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test';

export async function enlazarStores(page: Page, opciones: { medicion?: boolean } = {}): Promise<void> {
  await page.evaluate(async ({ medicion }) => {
    const w = window as any;
    const recursos = performance.getEntriesByType('resource').map((e) => e.name);
    const url = (patron: RegExp, respaldo: string) => {
      const hallados = recursos.filter((n) => patron.test(n));
      return hallados.length ? hallados[hallados.length - 1] : respaldo;
    };
    w.__s = (await import(/* @vite-ignore */ url(/\/useKuraStore\.ts/, '/src/store/useKuraStore.ts'))).useKuraStore;
    if (medicion) w.__m = (await import(/* @vite-ignore */ url(/\/measureStore\.ts/, '/src/store/measureStore.ts'))).useMeasureStore;
  }, { medicion: opciones.medicion === true });
}
