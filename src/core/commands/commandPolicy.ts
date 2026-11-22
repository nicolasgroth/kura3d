/**
 * @file src/core/commands/commandPolicy.ts
 * @description Fuente única de verdad del acceso (lectura o escritura) de cada comando del
 * Command Bus de Kura3D. La consumen el servidor MCP (rechazo en servidor), el puente WebSocket
 * y el cliente del puente en la UI (`src/utils/mcpBridgeClient.ts`). Módulo puro, sin dependencias
 * de Node, para poder importarse también desde el frontend.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { KuraCommandName } from './commandNames';

export type { KuraCommandName } from './commandNames';

/** Tipo de acceso de un comando: `read` no modifica escena ni disco; `write` sí. */
export type CommandAccess = 'read' | 'write';

/**
 * Acceso declarado para cada comando. El tipo `Record<KuraCommandName, …>` obliga a declarar
 * cualquier comando nuevo en compilación. Las exportaciones son `write` porque escriben en disco.
 */
export const COMMAND_ACCESS: Readonly<Record<KuraCommandName, CommandAccess>> = Object.freeze({
  get_scene_state: 'read',
  capture_viewport: 'read',
  analyze_printability: 'read',
  detect_structures: 'read',
  // Revalida el armado de un grupo dividido; no cambia la escena.
  validate_assembly: 'read',
  create_primitive: 'write',
  update_primitive_params: 'write',
  transform_object: 'write',
  delete_object: 'write',
  duplicate_object: 'write',
  boolean_operation: 'write',
  hollow_object: 'write',
  plane_cut: 'write',
  // Con dryRun solo planifica, pero el comando es de escritura (la ejecución reemplaza el objeto).
  split_for_bed: 'write',
  split_disconnected: 'write',
  group_objects: 'write',
  ungroup: 'write',
  combine_objects: 'write',
  separate_bodies: 'write',
  split_by_color: 'write',
  apply_texture: 'write',
  paint_object: 'write',
  import_svg: 'write',
  set_printer_profile: 'write',
  set_unit_system: 'write',
  export_stl: 'write',
  export_3mf: 'write',
  generate_mold: 'write',
  project_on_surface: 'write',
  simplify_mesh: 'write',
  refine_mesh: 'write',
  create_thread: 'write',
  convex_hull: 'write',
  align_objects: 'write',
  set_material: 'write',
  colorize_structures: 'write',
  extract_structure: 'write',
  mirror_object: 'write',
});

/** Indica si el nombre corresponde a un comando conocido del Command Bus. */
export function isKnownCommand(command: string): command is KuraCommandName {
  return Object.prototype.hasOwnProperty.call(COMMAND_ACCESS, command);
}

/** Indica si un comando es de solo lectura. Comandos desconocidos se tratan como escritura. */
export function isReadCommand(command: string): boolean {
  return isKnownCommand(command) && COMMAND_ACCESS[command] === 'read';
}

/** Lista ordenada de comandos permitidos en modo Solo Lectura. */
export const READ_COMMANDS: readonly KuraCommandName[] = Object.freeze(
  (Object.keys(COMMAND_ACCESS) as KuraCommandName[]).filter((c) => COMMAND_ACCESS[c] === 'read')
);

/**
 * Comando del Command Bus que ejecuta cada herramienta MCP `kura_*`.
 * Permite anotar `readOnlyHint` en la lista de herramientas con la misma fuente de verdad.
 */
export const TOOL_COMMANDS: Readonly<Record<string, KuraCommandName>> = Object.freeze({
  kura_get_scene_state: 'get_scene_state',
  kura_create_primitive: 'create_primitive',
  kura_update_primitive_params: 'update_primitive_params',
  kura_transform_object: 'transform_object',
  kura_delete_object: 'delete_object',
  kura_boolean_operation: 'boolean_operation',
  kura_hollow_object: 'hollow_object',
  kura_plane_cut: 'plane_cut',
  kura_split_for_bed: 'split_for_bed',
  kura_split_disconnected: 'split_disconnected',
  kura_group_objects: 'group_objects',
  kura_ungroup: 'ungroup',
  kura_combine_objects: 'combine_objects',
  kura_separate_bodies: 'separate_bodies',
  kura_split_by_color: 'split_by_color',
  kura_apply_texture: 'apply_texture',
  kura_paint_object: 'paint_object',
  kura_import_svg: 'import_svg',
  kura_set_units: 'set_unit_system',
  kura_set_printer_profile: 'set_printer_profile',
  kura_export_stl: 'export_stl',
  kura_export_3mf: 'export_3mf',
  kura_capture_viewport: 'capture_viewport',
  kura_generate_mold: 'generate_mold',
  kura_project_on_surface: 'project_on_surface',
  kura_analyze_printability: 'analyze_printability',
  kura_simplify_mesh: 'simplify_mesh',
  kura_refine_mesh: 'refine_mesh',
  kura_create_thread: 'create_thread',
  kura_convex_hull: 'convex_hull',
  kura_align_objects: 'align_objects',
  kura_set_material: 'set_material',
  kura_detect_structures: 'detect_structures',
  kura_colorize_structures: 'colorize_structures',
  kura_extract_structure: 'extract_structure',
  kura_mirror_object: 'mirror_object',
  kura_validate_assembly: 'validate_assembly',
});

/** Acceso de una herramienta MCP; herramientas no declaradas se tratan como escritura. */
export function toolAccess(toolName: string): CommandAccess {
  const command = TOOL_COMMANDS[toolName];
  return command ? COMMAND_ACCESS[command] : 'write';
}
