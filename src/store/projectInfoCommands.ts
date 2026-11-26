/**
 * @file src/store/projectInfoCommands.ts
 * @description Comandos de datos del proyecto del Command Bus: `get_project_info` (lectura) y `set_project_info`
 * (descripción, notas y autor). Llama a la misma acción del store que la interfaz (`setProjectInfo`): marca el
 * proyecto como modificado, no es un paso de deshacer (igual que el nombre del proyecto) y no cambia fechas.
 * Herramientas MCP: `kura_get_project_info` y `kura_set_project_info` (`mcp-server/src/projectInfoTools.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { parseSetProjectInfo, projectInfoToUser } from '../core/bus/projectInfoSchemas';
import { CommandError } from './commandErrors';
import type { RawParams } from './commandValidation';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

const view = (s: KuraStoreState) => projectInfoToUser(s.projectName, s.projectInfo, s.projectWorkSeconds);

export const PROJECT_INFO_HANDLERS = {
  get_project_info: (_p: RawParams, { get }: Deps) => view(get()),

  set_project_info: (p: RawParams, { get }: Deps) => {
    const patch = parseSetProjectInfo(p);
    if (get().projectBusy) throw new CommandError('busy', 'bus.error.busy');
    const changed = get().setProjectInfo(patch);
    return { ...view(get()), changed };
  },
};
