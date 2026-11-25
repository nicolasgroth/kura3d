/**
 * @file src/store/platesTypes.ts
 * @description Tipos del slice de placas de impresión: lista de placas de la escena, placa activa y acciones
 * (crear, borrar, renombrar, asignar piezas, fijar la activa). Modelo en `core/scene/plates.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PlateBed, SceneLayout, ScenePlate } from '../types/plates';

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
  /**
   * Borra una placa llevando sus piezas, trasladadas a su hueco equivalente, a la primera placa que queda (la
   * que la interfaz anuncia). Un solo paso de deshacer. Devuelve el id de esa placa, o null si no se pudo borrar.
   */
  removePlate: (plateId: string) => string | null;
  /** Vista «Solo esta»: el visor dibuja solo la cama de la placa activa. Preferencia de sesión, sin deshacer. */
  plateSolo: boolean;
  setPlateSolo: (solo: boolean) => void;
  /**
   * Mueve `ids` (o la selección) a una placa y las traslada al hueco equivalente de ella; `null` crea una placa
   * nueva para recibirlas. Un solo paso de deshacer. Devuelve cuántas piezas cambiaron de placa.
   */
  moveToPlate: (plateId: string | null, ids?: string[]) => number;
  /** Tras un arrastre: cada pieza pasa a la placa sobre la que quedó (sin paso propio: va en el del arrastre). */
  reassignPlatesByPosition: (ids: string[]) => void;
  /**
   * Modo de vista de la escena: poses de impresión o de armado (`core/scene/layoutPoses.ts`). Entra en la
   * instantánea del historial (cada paso recuerda su modo) y en el `.kura` v4; 'print' = el de siempre.
   */
  layout: SceneLayout;
  /**
   * Cambia de modo intercambiando pose viva y `restPose` de cada pieza. NO es un paso de deshacer. false si ya
   * estaba en ese modo o la escena está ocupada (operación en curso o arrastre sin soltar).
   */
  setLayout: (to: SceneLayout) => boolean;
}
