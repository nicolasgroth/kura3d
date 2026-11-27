/**
 * @file src/store/assemblyInstructionsCommands.ts
 * @description Comando de solo lectura `get_assembly_instructions` del Command Bus: instrucciones de armado de un
 * grupo dividido (por `groupId`, o por `ids` de piezas del mismo grupo: solo sus uniones internas), con los pasos y la
 * lista de materiales en ejes del usuario y cada paso en una frase en inglés. Mismo esquema de destino que
 * `validate_assembly`. Herramienta MCP: `kura_get_assembly_instructions` (`mcp-server/src/assemblyInstructionsTools.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { assemblyInstructionsResponse } from '../core/assembly/assemblyInstructionsScene';
import type { RawParams } from './commandValidation';
import { parseValidateAssembly } from './splitCommandSchemas';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

export const ASSEMBLY_INSTRUCTIONS_HANDLERS = {
  get_assembly_instructions: (p: RawParams, { get }: Deps) => {
    const targets = parseValidateAssembly(get(), p);
    return assemblyInstructionsResponse(get().objects, targets);
  },
};
