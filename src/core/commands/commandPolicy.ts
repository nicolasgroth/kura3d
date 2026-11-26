/**
 * @file src/core/commands/commandPolicy.ts
 * @description Fuente única de verdad del acceso (lectura o escritura) de cada comando del
 * Command Bus de Kurra Studio. La consumen el servidor MCP (rechazo en servidor), el puente WebSocket
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
  measure_distance: 'read',
  measure_object: 'read',
  measure_capacity: 'read',
  diagnose_mesh: 'read',
  // Comprobar encaje: calcula choques y holguras sin cambiar la escena.
  check_fit: 'read',
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
  // Con dryRun solo analiza; aplicar cambia la transformación del bloque (un paso de deshacer).
  fit_to_bed: 'write',
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
  repair_mesh: 'write',
  set_object_role: 'write',
  // Recetas: leer, describir y validar no tocan la escena; ejecutar (también con `dryRun`) es escritura.
  list_recipes: 'read',
  describe_recipe: 'read',
  validate_recipe: 'read',
  run_recipe: 'write',
  smooth_mesh: 'write',
  // Orientar para imprimir: solo mide y ordena orientaciones; aplicar una es `apply_orientation`.
  orient_for_print: 'read',
  apply_orientation: 'write',
  add_magnet_pocket: 'write',
  add_screw_boss: 'write',
  add_keyhole: 'write',
  add_cable_pass: 'write',
  // Repartir en placas: con dryRun solo planifica; aplicar crea placas y mueve piezas (un paso de deshacer).
  arrange_on_plates: 'write',
  // Placas (lote P8): listar no cambia nada; el resto cambia la escena (un paso de deshacer) o el estado de vista
  // (placa activa, modo imprimir/armado), que también es escritura.
  list_plates: 'read',
  create_plate: 'write',
  rename_plate: 'write',
  delete_plate: 'write',
  set_active_plate: 'write',
  move_to_plate: 'write',
  spread_one_plate_per_object: 'write',
  set_plate_bed: 'write',
  set_layout: 'write',
  // Datos del proyecto (descripción, notas, autor): leer no cambia nada; escribir no toca la escena ni el historial.
  get_project_info: 'read',
  set_project_info: 'write',
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
  kura_fit_to_bed: 'fit_to_bed',
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
  kura_measure_distance: 'measure_distance',
  kura_measure_object: 'measure_object',
  kura_measure_capacity: 'measure_capacity',
  kura_repair_mesh: 'repair_mesh',
  kura_diagnose_mesh: 'diagnose_mesh',
  kura_check_fit: 'check_fit',
  kura_set_object_role: 'set_object_role',
  kura_list_recipes: 'list_recipes',
  kura_describe_recipe: 'describe_recipe',
  kura_validate_recipe: 'validate_recipe',
  kura_run_recipe: 'run_recipe',
  kura_smooth_mesh: 'smooth_mesh',
  kura_orient_for_print: 'orient_for_print',
  kura_apply_orientation: 'apply_orientation',
  kura_add_magnet_pocket: 'add_magnet_pocket',
  kura_add_screw_boss: 'add_screw_boss',
  kura_add_keyhole: 'add_keyhole',
  kura_add_cable_pass: 'add_cable_pass',
  kura_list_plates: 'list_plates',
  kura_create_plate: 'create_plate',
  kura_rename_plate: 'rename_plate',
  kura_delete_plate: 'delete_plate',
  kura_set_active_plate: 'set_active_plate',
  kura_move_to_plate: 'move_to_plate',
  kura_spread_one_plate_per_object: 'spread_one_plate_per_object',
  kura_arrange_on_plates: 'arrange_on_plates',
  kura_set_plate_bed: 'set_plate_bed',
  kura_set_layout: 'set_layout',
});

/** Acceso de una herramienta MCP; herramientas no declaradas se tratan como escritura. */
export function toolAccess(toolName: string): CommandAccess {
  const command = TOOL_COMMANDS[toolName];
  return command ? COMMAND_ACCESS[command] : 'write';
}
