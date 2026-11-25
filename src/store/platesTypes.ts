/**
 * @file src/store/platesTypes.ts
 * @description Tipos del slice de placas de impresión: lista de placas de la escena, placa activa y acciones
 * (crear, borrar, renombrar, asignar piezas, fijar la activa). Modelo en `core/scene/plates.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PlateBed, ScenePlate } from '../types/plates';

export interface PlatesSliceState {
  /** Placas de la escena; vacío = una placa implícita en el origen (como siempre). Entra en el historial. */
  plates: ScenePlate[];
  /**
   * Placa activa (donde cae lo nuevo y a la que se refiere la cama activa). Estado de vista: no es un paso
   * de deshacer ni se guarda en el `.kura`. Un id que ya no existe equivale a la primera placa.
   */
  activePlateId: string | null;
  /** Agrega una placa en un hueco libre y la deja activa. Un paso de deshacer. null si no se pudo. */
  createPlate: (options?: { name?: string; bed?: PlateBed }) => ScenePlate | null;
  /**
   * Borra una placa; sus piezas pasan a `reassignTo` (por defecto la primera que queda; `null` = sin placa).
   * No borra la última. Un paso de deshacer.
   */
  deletePlate: (plateId: string, reassignTo?: string | null) => boolean;
  /** Renombra una placa. Un paso de deshacer. */
  renamePlate: (plateId: string, name: string) => boolean;
  /** Asigna `ids` (o la selección) a la placa; solo sólidos no bloqueados. Devuelve cuántas piezas cambiaron. */
  assignToPlate: (plateId: string, ids?: string[]) => number;
  /** Fija la placa activa (sin paso de deshacer). false si la placa no existe. */
  setActivePlate: (plateId: string) => boolean;
}
