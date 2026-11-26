/**
 * @file src/engine/__tests__/svgParityFixtures.ts
 * @description SVG de prueba para la paridad del lector: uno con `<g transform>`, `<defs>/<use>`,
 * trazos `fill="none"` y un agujero, y su equivalente aplanado; más medidas de contornos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Cuadrado 40×40 con agujero 20×20 desplazado por `<g transform>`, un `<use>` y trazos sin relleno. */
export const COMPLEX_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 60">
  <defs><rect id="sq" width="10" height="10"/></defs>
  <g transform="translate(20,0)">
    <path fill-rule="evenodd" d="M0 0 H40 V40 H0 Z M10 10 V30 H30 V10 Z"/>
  </g>
  <use xlink:href="#sq" x="70" y="0"/>
  <path d="M0 50 H100 V58 H0 Z" fill="none" stroke="#000" stroke-width="2"/>
  <g fill="none" stroke="#f00"><circle cx="50" cy="50" r="5"/></g>
</svg>`;

/** Misma figura rellena que `COMPLEX_SVG`, sin transformaciones, referencias ni trazos. */
export const FLAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60">
  <path fill-rule="evenodd" d="M20 0 H60 V40 H20 Z M30 10 V30 H50 V10 Z"/>
  <rect x="70" y="0" width="10" height="10"/>
</svg>`;

type Groups = [number, number][][][];

/** Caja `[minX, minY, maxX, maxY]` de todos los anillos. */
export function groupsBounds(groups: Groups): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of groups) for (const r of g) for (const [x, y] of r) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}

/** Área rellena con regla par-impar dentro de cada grupo (anillo exterior menos agujeros). */
export function groupsArea(groups: Groups): number {
  let total = 0;
  for (const g of groups) {
    const areas = g.map((r) => {
      let s = 0;
      for (let i = 0; i < r.length; i++) {
        const [x0, y0] = r[i];
        const [x1, y1] = r[(i + 1) % r.length];
        s += x0 * y1 - x1 * y0;
      }
      return Math.abs(s / 2);
    });
    const outer = Math.max(...areas);
    total += 2 * outer - areas.reduce((a, b) => a + b, 0);
  }
  return total;
}
