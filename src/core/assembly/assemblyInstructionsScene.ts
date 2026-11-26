/**
 * @file src/core/assembly/assemblyInstructionsScene.ts
 * @description Puente entre la escena y las instrucciones de armado: arma la entrada del cálculo con las piezas de un
 * grupo dividido (`metadata.split`: código, uniones guardadas, paso validado, pose de armado), los tarugos sueltos del
 * grupo (`metadata.splitDowel`) y las uniones débiles y piezas trabadas de las notas guardadas; da el nombre del
 * modelo (el de las piezas sin su código) y la respuesta JSON del bus y el MCP (ejes del usuario, frases en inglés).
 * La comparten la app y el servidor MCP sin interfaz. Sin React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObjectMetadata, SplitPartMetadata } from '../../types/kura';
import { computeAssemblyInstructions } from './assemblyInstructions';
import type { AssemblyInstructions, InstructionsInput } from './assemblyInstructionsTypes';
import { materialLines, stepSentence } from './assemblyInstructionsText';

/** Forma mínima de un objeto de escena que mira este puente (la cumplen `SceneObject` y el objeto del MCP). */
export interface InstructionSceneObject {
  id: string;
  name: string;
  stats: { volumeMm3: number };
  metadata?: SceneObjectMetadata;
}

type SplitObject = InstructionSceneObject & { metadata: { split: SplitPartMetadata } };

const isSplit = (o: InstructionSceneObject): o is SplitObject => Boolean(o.metadata?.split);

/** Nombre del modelo dividido: el de una pieza sin el «· código» final. */
export function splitModelName(parts: readonly InstructionSceneObject[]): string {
  const first = [...parts].filter(isSplit).sort((a, b) => (a.metadata.split.code < b.metadata.split.code ? -1 : 1))[0];
  if (!first) return '';
  const code = first.metadata.split.code;
  let base = first.name.endsWith(code) ? first.name.slice(0, -code.length).trimEnd() : first.name;
  if (base.endsWith('·')) base = base.slice(0, -1).trimEnd();
  return base || first.name;
}

/** Entrada del cálculo para `targets` (piezas de un mismo grupo); `objects` aporta los tarugos sueltos del grupo. */
export function instructionsInputOf(objects: readonly InstructionSceneObject[], targets: readonly InstructionSceneObject[]): InstructionsInput {
  const parts = targets.filter(isSplit);
  const groupId = parts[0]?.metadata.split.groupId;
  const notes = parts.find((o) => o.metadata.split.groupNotes)?.metadata.split.groupNotes;
  const dowels = objects
    .map((o) => o.metadata?.splitDowel)
    .filter((d): d is NonNullable<typeof d> => Boolean(d) && d!.groupId === groupId)
    .map((d) => ({ diameterMm: d.diameterMm, lengthMm: d.lengthMm, count: d.count }));
  return {
    parts: parts.map((o) => {
      const s = o.metadata.split;
      return {
        id: o.id,
        code: s.code,
        name: o.name,
        volumeMm3: o.stats.volumeMm3,
        // Malla local con la base en Y = 0: la cota baja del armado es la Y de su posición.
        bottomMm: s.assembly.position[1],
        ...(typeof s.assemblyStep === 'number' ? { assemblyStep: s.assemblyStep } : {}),
        ...(s.insertDirection ? { insertDirection: s.insertDirection } : {}),
        joints: s.joints ?? [],
      };
    }),
    dowels,
    weakJoints: [...(notes?.weakJoints ?? []), ...(notes?.report?.weak ?? []).map((w) => w.joint)],
    blocked: notes?.report?.blocked ?? [],
  };
}

/** Instrucciones del grupo de `targets`. */
export function sceneAssemblyInstructions(objects: readonly InstructionSceneObject[], targets: readonly InstructionSceneObject[]): AssemblyInstructions {
  return computeAssemblyInstructions(instructionsInputOf(objects, targets));
}

/** Respuesta de `get_assembly_instructions` (bus y MCP): datos en ejes del usuario y cada paso en una frase en inglés. */
export function assemblyInstructionsResponse(objects: readonly InstructionSceneObject[], targets: readonly InstructionSceneObject[]) {
  const out = sceneAssemblyInstructions(objects, targets);
  const first = targets.find(isSplit);
  return {
    groupId: first?.metadata.split.groupId ?? null,
    model: splitModelName(targets),
    steps: out.steps.map((s) => ({ ...s, text: stepSentence('en', s) })),
    materials: { ...out.materials, text: materialLines('en', out.materials) },
  };
}
