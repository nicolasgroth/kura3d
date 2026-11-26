/**
 * @file mcp-server/src/headlessProjectInfo.ts
 * @description Datos del proyecto en el modo sin interfaz (`kura_get_project_info` / `kura_set_project_info` sin la
 * app): viven en memoria mientras corre el servidor, con el mismo esquema (`parseSetProjectInfo`), la misma limpieza
 * (`applyProjectInfoPatch`) y la misma respuesta (`projectInfoToUser`) que el Command Bus. No hay proyecto `.kura`
 * abierto: el nombre es null, sin fechas ni tiempo de trabajo. Al exportar un 3MF sin interfaz, la descripción y el
 * autor viajan como metadatos `Description` / `Designer`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { parseSetProjectInfo, projectInfoToUser } from '../../src/core/bus/projectInfoSchemas';
import type { ProjectInfo } from '../../src/project/projectInfo';
import { applyProjectInfoPatch } from '../../src/project/projectInfoPatch';

export class HeadlessProjectInfo {
  private info: Omit<ProjectInfo, 'workSeconds'> = {};

  /** Nombre (null sin proyecto abierto) y datos para el 3MF. */
  snapshot(): { projectName: string | null; projectInfo: Omit<ProjectInfo, 'workSeconds'> } {
    return { projectName: null, projectInfo: { ...this.info } };
  }

  get() {
    return { ...projectInfoToUser(null, this.info, 0), mode: 'headless' as const };
  }

  /** Lanza `invalid-params` (CommandError) como el bus si los parámetros no valen. */
  set(params: Record<string, unknown>) {
    const patch = parseSetProjectInfo(params);
    const { next, changed } = applyProjectInfoPatch(this.info, patch);
    this.info = next;
    return { ...this.get(), changed };
  }
}
