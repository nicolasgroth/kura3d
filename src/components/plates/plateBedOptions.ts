/**
 * @file src/components/plates/plateBedOptions.ts
 * @description Opciones del selector «Cama de esta placa…» (sin React): «La del proyecto», las impresoras incluidas
 * (las que tienen volumen de impresión) y «Mis camas», cada una con su cama propia lista para `setPlateBed`, y cuál
 * corresponde a la cama actual de la placa. Una cama propia cuyo perfil ya no existe (archivo de otro equipo, perfil
 * borrado) aparece como opción propia con sus medidas: nunca se pierde al abrir el selector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { plateBedFromProfile, samePlateBed } from '../../core/scene/plateBedChange';
import { DEFAULT_PRINTER_PROFILES, type PrinterProfile } from '../../types/kura';
import type { PlateBed, ScenePlate } from '../../types/plates';

export type PlateBedGroup = 'project' | 'builtin' | 'mine' | 'current';

export interface PlateBedOption {
  /** Clave estable del control (`project`, `profile:<id>` o `current`). */
  key: string;
  group: PlateBedGroup;
  /** Nombre visible (ya localizado para los perfiles de fábrica). */
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Cama a aplicar; null = la del proyecto. */
  bed: PlateBed | null;
}

export const PROJECT_KEY = 'project';
export const CURRENT_KEY = 'current';

/** Opciones en orden de grupo. `localName` da el nombre visible de un perfil de fábrica. */
export function plateBedOptions(
  plate: ScenePlate,
  projectBed: { name: string; widthMm: number; depthMm: number; heightMm: number },
  userBeds: readonly PrinterProfile[],
  localName: (p: PrinterProfile) => string,
): { options: PlateBedOption[]; selected: string } {
  const fromProfile = (p: PrinterProfile, group: PlateBedGroup): PlateBedOption => ({
    key: `profile:${p.id}`, group, name: group === 'builtin' ? localName(p) : p.name,
    widthMm: p.bedWidthMm, depthMm: p.bedDepthMm, heightMm: p.maxHeightMm, bed: plateBedFromProfile(p),
  });
  const options: PlateBedOption[] = [
    { key: PROJECT_KEY, group: 'project', name: projectBed.name, widthMm: projectBed.widthMm, depthMm: projectBed.depthMm, heightMm: projectBed.heightMm, bed: null },
    ...DEFAULT_PRINTER_PROFILES.filter((p) => p.showPrintVolume).map((p) => fromProfile(p, 'builtin')),
    ...userBeds.map((p) => fromProfile(p, 'mine')),
  ];
  const own = plate.bed;
  if (!own) return { options, selected: PROJECT_KEY };
  const match = options.find((o) => o.bed && samePlateBed(o.bed, own));
  if (match) return { options, selected: match.key };
  // Cama propia sin perfil que la reproduzca: se ofrece tal cual para poder conservarla.
  options.splice(1, 0, { key: CURRENT_KEY, group: 'current', name: own.name, widthMm: own.widthMm, depthMm: own.depthMm, heightMm: own.heightMm, bed: own });
  return { options, selected: CURRENT_KEY };
}
