/**
 * @file src/types/plates.ts
 * @description Tipos de las placas de impresión de la escena (ver `docs/diseno/PLACAS_Y_ARMADO.md`, sección 1):
 * una placa es una cama con nombre y origen propio en el mundo; cada pieza apunta a una sola placa con
 * `SceneObject.plateRef`. Sin placas (todo proyecto anterior) hay una placa implícita en el origen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Cama propia de una placa (otra impresora); ausente = la cama del proyecto. */
export interface PlateBed {
  profileId?: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Margen por lado (mm), como `PrinterProfile.marginMm`. */
  marginMm?: number;
}

/** Placa de impresión: una cama con origen propio en el mundo. */
export interface ScenePlate {
  id: string;
  /** «Placa 1», editable. */
  name: string;
  /** Centro de la cama en el mundo [X, Z] (mm). La primera placa queda en [0, 0]. */
  origin: [number, number];
  /** Cama propia; ausente = la del proyecto. */
  bed?: PlateBed;
  /** «Repartir» no la toca (P5). */
  locked?: boolean;
}

/** Disposición de la escena: poses de impresión (sobre las placas) o de armado (la figura compuesta). */
export type SceneLayout = 'print' | 'assembly';

/** Pose guardada del modo que no está activo (ver `SceneObject.restPose`). */
export interface RestPose {
  position: [number, number, number];
  rotation: [number, number, number];
}
