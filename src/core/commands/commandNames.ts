/**
 * @file src/core/commands/commandNames.ts
 * @description Nombres de los comandos del Command Bus de Kura3D. Contrato compartido por la app
 * (store, puente MCP en la UI) y el servidor MCP; sin dependencias de interfaz ni de Node.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Nombres de comandos aceptados por el Command Bus de Kura3D. */
export type KuraCommandName =
  | 'get_scene_state'
  | 'create_primitive'
  | 'update_primitive_params'
  | 'transform_object'
  | 'delete_object'
  | 'duplicate_object'
  | 'boolean_operation'
  | 'hollow_object'
  | 'plane_cut'
  | 'split_for_bed'
  | 'split_disconnected'
  | 'group_objects'
  | 'ungroup'
  | 'combine_objects'
  | 'separate_bodies'
  | 'split_by_color'
  | 'apply_texture'
  | 'paint_object'
  | 'import_svg'
  | 'set_printer_profile'
  | 'set_unit_system'
  | 'export_stl'
  | 'export_3mf'
  | 'capture_viewport'
  | 'generate_mold'
  | 'project_on_surface'
  | 'analyze_printability'
  | 'simplify_mesh'
  | 'refine_mesh'
  | 'create_thread'
  | 'convex_hull'
  | 'align_objects'
  | 'set_material'
  | 'detect_structures'
  | 'colorize_structures'
  | 'extract_structure'
  | 'mirror_object'
  | 'validate_assembly'
  | 'measure_distance'
  | 'measure_object'
  | 'measure_capacity';
