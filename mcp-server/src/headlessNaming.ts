/**
 * @file mcp-server/src/headlessNaming.ts
 * @description Nombres de resultado del MCP headless (fijos, sin idioma activo) para las
 * operaciones compartidas de `src/core/operations`, en INGLÉS: quien lee la respuesta es una IA;
 * la app usa `createKeyedNaming` con i18n.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { shortMm, type ResultNaming } from '../../src/core/scene/resultNames';

/** Piezas de molde en inglés (mismas que `mold.part.*` de la app en inglés). */
const MOLD_PARTS: Record<string, string> = {
  single: 'One-part mold', halfA: 'Mold A', halfB: 'Mold B', motherBox: 'Mother box (silicone)',
  positive: 'Master positive', outer: 'Outer mold', core: 'Inner core',
};

const capitalize = (value: string) => (value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value);

/** `counter` devuelve el contador de objetos actual del motor headless. */
export function createHeadlessNaming(counter: () => number): ResultNaming {
  return {
    primitive: (type) => `${capitalize(type)} ${counter() + 1}`,
    modulePrefix: (isHole) => (isHole ? '−' : '+'),
    primitiveLabel: capitalize,
    booleanResult: (op, inputs) => `${inputs[0].name} (${op})`,
    cutHalf: (src, half, axis) => `${src.name} — half ${half === 'a' ? `A (${axis}−)` : `B (${axis}+)`}`,
    piece: (src, i) => `${src.name} #${i + 1}`,
    colorPart: (src, color, i) => `${src.name} (${color}) #${i + 1}`,
    moldPart: (src, part) => `${MOLD_PARTS[part.label] ?? part.label} — ${src.name}`,
    hull: () => `ConvexHull_${counter() + 1}`,
    thread: (o) => `${o.kind === 'bolt' ? 'Bolt' : o.kind === 'nut' ? 'Nut' : 'Threaded hole'} M${o.diameterMm}x${o.pitchMm}`,
    structurePart: (src, _regions, region) => `${src.name}_${region.labelEn}`,
    splitPart: (src, code) => `${src.name} · ${code}`,
    looseDowel: (d, l, count) => `Dowel Ø${shortMm(d)}×${shortMm(l)} ×${count}`,
  };
}
