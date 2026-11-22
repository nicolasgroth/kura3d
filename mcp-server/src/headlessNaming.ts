/**
 * @file mcp-server/src/headlessNaming.ts
 * @description Nombres de resultado del MCP headless (fijos, sin idioma activo) para las
 * operaciones compartidas de `src/core/operations`. Conserva los nombres históricos del servidor;
 * la app usa `createKeyedNaming` con i18n.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ResultNaming } from '../../src/core/scene/resultNames';

const capitalize = (value: string) => (value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value);

/** `counter` devuelve el contador de objetos actual del motor headless. */
export function createHeadlessNaming(counter: () => number): ResultNaming {
  return {
    primitive: (type) => `${capitalize(type)} ${counter() + 1}`,
    modulePrefix: (isHole) => (isHole ? '−' : '+'),
    primitiveLabel: capitalize,
    booleanResult: (op, inputs) => `${inputs[0].name} (${op})`,
    cutHalf: (src, half) => `${src.name} — mitad ${half === 'a' ? 'A' : 'B'}`,
    piece: (src, i) => `${src.name} #${i + 1}`,
    colorPart: (src, color, i) => `${src.name} (${color}) #${i + 1}`,
    moldPart: (src, part) => `${part.nameSuffix} — ${src.name}`,
    hull: () => `ConvexHull_${counter() + 1}`,
    thread: (o) => `${o.kind === 'bolt' ? 'Perno' : o.kind === 'nut' ? 'Tuerca' : 'Cavidad'} M${o.diameterMm}x${o.pitchMm}`,
    structurePart: (src, _regions, region) => `${src.name}_${region.labelEn}`,
  };
}
