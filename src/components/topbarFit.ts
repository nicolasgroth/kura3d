/**
 * @file src/components/topbarFit.ts
 * @description Algoritmo puro de niveles de ahorro de la barra superior adaptativa. Recibe el ancho
 * disponible y los anchos naturales medidos por nivel, y elige el nivel más bajo que cabe o el
 * siguiente nivel que falta medir. Sube y baja de nivel según cambie el espacio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Tolerancia en píxeles para redondeos de subpíxel. */
const FIT_TOLERANCE = 1;

/**
 * Elige el nivel de ahorro.
 * @param available ancho disponible del contenedor.
 * @param widths ancho natural del contenido medido en cada nivel (`undefined` = sin medir).
 * @param maxLevel nivel máximo posible.
 * @returns el nivel más bajo cuyo ancho cabe; si antes aparece un nivel sin medir, ese nivel
 * (para medirlo); si ninguno cabe, `maxLevel`.
 */
export function pickTopbarLevel(
  available: number,
  widths: ReadonlyArray<number | undefined>,
  maxLevel: number,
): number {
  for (let level = 0; level <= maxLevel; level += 1) {
    const width = widths[level];
    if (width === undefined) return level;
    if (width <= available + FIT_TOLERANCE) return level;
  }
  return maxLevel;
}

/**
 * Registra la medición del nivel actual. Si el ancho medido difiere del guardado para ese mismo
 * nivel, el contenido cambió (título, idioma, etiquetas) y las demás mediciones quedan obsoletas.
 * @returns la nueva tabla de anchos (no muta la recibida).
 */
export function recordTopbarWidth(
  widths: ReadonlyArray<number | undefined>,
  level: number,
  width: number,
): Array<number | undefined> {
  const previous = widths[level];
  const stale = previous !== undefined && Math.abs(previous - width) > FIT_TOLERANCE;
  const next: Array<number | undefined> = stale ? [] : [...widths];
  next[level] = width;
  return next;
}

/** Ancho natural de una fila flex: suma de hijos + separaciones + relleno, sin crecimiento flex. */
export function naturalRowWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const gap = parseFloat(style.columnGap) || 0;
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const groups = Array.from(el.children) as HTMLElement[];
  let total = padding + gap * Math.max(0, groups.length - 1);
  for (const group of groups) {
    const items = Array.from(group.children) as HTMLElement[];
    const groupStyle = getComputedStyle(group);
    const groupGap = parseFloat(groupStyle.columnGap) || 0;
    let groupWidth = groupGap * Math.max(0, items.length - 1);
    for (const item of items) groupWidth += item.getBoundingClientRect().width;
    total += items.length > 0 ? groupWidth : group.getBoundingClientRect().width;
  }
  return Math.ceil(total);
}
