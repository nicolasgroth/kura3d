/**
 * @file src/ai/toolSchemas.ts
 * @description Catálogo de herramientas de escena que Kura3D expone a los proveedores IA. Es también la
 * lista permitida: un comando que no figure aquí nunca se ejecuta desde una respuesta de proveedor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { PRIMITIVE_LIMITS, PRIMITIVE_PARAM_RANGES, type PrimitiveRangeKey } from '../engine/primitiveLimits';
import type { KuraCommandRequest } from '../types/kura';

/** Propiedad numérica de primitiva con `minimum`/`maximum` tomados del motor (fuente única). */
const dim = (key: PrimitiveRangeKey, description: string) => ({
  type: 'number',
  description,
  minimum: PRIMITIVE_PARAM_RANGES[key].min,
  maximum: PRIMITIVE_PARAM_RANGES[key].max,
});

/** Definición neutral de herramienta compartida entre proveedores LLM. */
export interface KuraToolSchema {
  name: KuraCommandRequest['command'];
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
  };
}

/** Catálogo compacto de herramientas de modelado 3D expuestas al modelo de lenguaje. */
export const KURA_TOOL_SCHEMAS: KuraToolSchema[] = [
  {
    name: 'get_scene_state',
    description: 'Obtiene el listado de objetos actuales en la escena, dimensiones en mm, selección y unidad activa.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'create_primitive',
    description: 'Crea una nueva primitiva 3D paramétrica apoyada sobre la cama de impresión (en mm).',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['box', 'cylinder', 'tube', 'sphere', 'cone', 'torus', 'prism', 'text'],
          description: 'Tipo de primitiva geométrica.',
        },
        width: dim('width', 'Ancho en mm (para box/prism).'),
        height: dim('height', 'Altura en mm.'),
        depth: dim('depth', 'Profundidad en mm.'),
        radius: dim('radius', 'Radio en mm (sphere/cylinder/cone).'),
        outerRadius: dim('outerRadius', 'Radio exterior en mm (tube/torus).'),
        innerRadius: dim('innerRadius', 'Radio interior en mm (tube).'),
        text: { type: 'string', description: 'Texto a extruir si type=text.', maxLength: PRIMITIVE_LIMITS.maxTextLength },
        name: { type: 'string', description: 'Nombre descriptivo opcional.' },
        color: { type: 'string', description: 'Color hexadecimal #rrggbb opcional.' },
      },
      required: ['type'],
    },
  },
  {
    name: 'transform_object',
    description: 'Mueve, rota, escala, centra o apoya un objeto en la cama (Y=0).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID del objeto (si se omite usa el seleccionado).' },
        position: { type: 'array', items: { type: 'number' }, description: '[x, y, z] en mm.' },
        rotation: { type: 'array', items: { type: 'number' }, description: '[rx, ry, rz] en radianes.' },
        scale: { type: 'array', items: { type: 'number' }, description: '[sx, sy, sz].' },
        dropToBed: { type: 'boolean', description: 'Si es true, apoya la base del objeto en Y=0.' },
        centerOnBed: { type: 'boolean', description: 'Si es true, centra el objeto en X=0, Z=0 sobre la cama.' },
      },
    },
  },
  {
    name: 'hollow_object',
    description: 'Ahueca un sólido creando una cáscara cerrada (shell) con grosor de pared en mm.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        wallThickness: { type: 'number', description: 'Grosor de pared en mm (ej. 2.0).' },
        drainHole: { type: 'boolean', description: 'Agregar agujero inferior de drenaje.' },
      },
      required: ['wallThickness'],
    },
  },
  {
    name: 'boolean_operation',
    description: 'Ejecuta una operación booleana CSG Manifold entre dos objetos.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['union', 'subtract', 'intersect'] },
        targetId: { type: 'string' },
        toolId: { type: 'string' },
      },
      required: ['op'],
    },
  },
  {
    name: 'plane_cut',
    description: 'Corta un objeto por un plano X/Y/Z agregando conectores mecánicos automáticos.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        axis: { type: 'string', enum: ['x', 'y', 'z'] },
        offset: { type: 'number' },
        connectorType: { type: 'string', enum: ['none', 'dowel', 'peg', 'dovetail'] },
        connectorCount: { type: 'number' },
        tolerance: { type: 'number' },
      },
    },
  },
  {
    name: 'apply_texture',
    description: 'Aplica una textura superficial procedural (fuzzy skin, knurling, waves, honeycomb, grid).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        pattern: { type: 'string', enum: ['fuzzy', 'knurling', 'waves', 'honeycomb', 'grid'] },
        depth: { type: 'number', description: 'Profundidad del relieve en mm.' },
        scale: { type: 'number', description: 'Escala del patrón en mm.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'duplicate_object',
    description: 'Duplica el objeto especificado o seleccionado.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'delete_object',
    description: 'Elimina el objeto especificado o seleccionado.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'export_stl',
    description: 'Exporta la escena o selección actual a un archivo STL binario listo para imprimir.',
    parameters: {
      type: 'object',
      properties: { onlySelected: { type: 'boolean' } },
    },
  },
  {
    name: 'export_3mf',
    description: 'Exporta la escena multicolor en formato 3MF.',
    parameters: {
      type: 'object',
      properties: { onlySelected: { type: 'boolean' } },
    },
  },
];
