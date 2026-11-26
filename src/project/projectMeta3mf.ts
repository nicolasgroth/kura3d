/**
 * @file src/project/projectMeta3mf.ts
 * @description Datos del proyecto que se escriben en el 3MF como metadatos estándar: el nombre del proyecto como
 * `Title`, la descripción como `Description` y el autor como `Designer`. Los vacíos no viajan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ThreeMfProjectMeta } from '../engine/io/threeMfExport';
import type { ProjectInfo } from './projectInfo';

/** Metadatos del 3MF desde el nombre y los datos del proyecto (los del store o los del modo sin interfaz). */
export function projectMetaOf(state: {
  projectName: string | null;
  projectInfo?: Pick<ProjectInfo, 'description' | 'author'>;
}): ThreeMfProjectMeta {
  return { title: state.projectName, description: state.projectInfo?.description, designer: state.projectInfo?.author };
}
