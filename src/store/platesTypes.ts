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
  /**
   * Cama de una placa (P7): una propia (`PlateBed`) o `null` = la del proyecto. Si la cama nueva pisaría a otra placa,
   * las que chocan se recolocan con sus piezas (`core/scene/plateBedChange.ts`). Un paso de deshacer. Devuelve las
   * placas recolocadas, o null si no se pudo (placa inexistente, cama inválida, sin cambios o sin espacio).
   */
  setPlateBed: (plateId: string, bed: PlateBed | null) => { relocated: string[]; keptLocked: string[] } | null;
  /**
   * «Convertir grupos en placas» (P7): una placa real por grupo raíz (`groupIds`; sin ellos, los de la selección o los
   * que se llaman como placas), con sus piezas centradas en su cama (`core/scene/plateConvert.ts`). Solo en Imprimir.
   * Un paso de deshacer. null (con aviso) si no se convirtió ninguno.
   */
  convertGroupsToPlates: (groupIds?: string[]) => { created: string[]; skipped: string[] } | null;
  /** Asigna `ids` (o la selección) a la placa; solo sólidos no bloqueados. Devuelve cuántas piezas cambiaron. */
  assignToPlate: (plateId: string, ids?: string[]) => number;
  /** Fija la placa activa (sin paso de deshacer). false si la placa no existe. */
  setActivePlate: (plateId: string) => boolean;
  /**
   * Borra una placa llevando sus piezas, trasladadas a su hueco equivalente, a `targetId` o, sin él, a la primera
   * placa que queda (la que la interfaz anuncia). Un solo paso de deshacer. Devuelve el id de la placa destino, o null
   * si no se pudo borrar.
   */
  removePlate: (plateId: string, targetId?: string) => string | null;
  /** Vista «Solo esta»: el visor dibuja solo la cama de la placa activa. Preferencia de sesión, sin deshacer. */
  plateSolo: boolean;
  setPlateSolo: (solo: boolean) => void;
  /**
   * Mueve `ids` (o la selección) a una placa y las traslada al hueco equivalente de ella; `null` crea una placa
   * nueva para recibirlas. Un solo paso de deshacer. Devuelve cuántas piezas cambiaron de placa.
   */
  moveToPlate: (plateId: string | null, ids?: string[]) => number;
  /** El último `moveToPlate` dejó las piezas dentro de la cama destino (false: el bloque es más grande que ella). Solo sesión. */
  lastMoveToPlateFits: boolean;
  /** El último `moveToPlate` no halló hueco libre en la placa destino: la pieza quedó dentro de su cama, encima de otras. Solo sesión. */
  lastMoveToPlateCrowded: boolean;
  /**
   * «Una placa por objeto»: deja cada pieza sólida (las de `ids`, o la selección, o todas si no hay) en su propia placa,
   * centrada sobre su cama; crea las placas que falten y reutiliza las vacías. Un solo paso de deshacer. null si hay
   * menos de dos piezas participantes (bloqueadas, referencias y negativos no cuentan ni se mueven).
   */
  spreadOnePlatePerObject: (ids?: string[]) => { pieces: number; created: number } | null;
  /**
   * Tras un arrastre: cada pieza pasa a la placa sobre la que quedó. Dentro de un arrastre va en el paso de deshacer
   * del propio arrastre; fuera de uno, abre su paso (nunca cambia la escena sin poder deshacerse).
   */
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
