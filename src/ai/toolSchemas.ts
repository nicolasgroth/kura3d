/**
 * @file src/ai/toolSchemas.ts
 * @description Catálogo de herramientas de escena que Kura3D expone a los proveedores IA. Es también la
 * lista permitida: un comando que no figure aquí nunca se ejecuta desde una respuesta de proveedor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import {
  OPERATION_RANGES as OR, TRANSFORM_RANGES, type OperationRange,
} from '../engine/operationLimits';
import { PRIMITIVE_LIMITS, PRIMITIVE_PARAM_RANGES, TEXT_ALIGN_OPTIONS, type PrimitiveRangeKey } from '../engine/primitiveLimits';
import type { KuraCommandRequest } from '../types/kura';

/** Propiedad numérica de primitiva con `minimum`/`maximum` tomados del motor (fuente única). */
const dim = (key: PrimitiveRangeKey, description: string) => ({
  type: 'number',
  description,
  minimum: PRIMITIVE_PARAM_RANGES[key].min,
  maximum: PRIMITIVE_PARAM_RANGES[key].max,
});

/**
 * Propiedad numérica con el rango de la fuente única (`operationLimits`). Solo emite `minimum`/`maximum`
 * (subconjunto que aceptan todos los proveedores); el mínimo exclusivo y los enteros los aplica
 * `toolValidation` leyendo el rango original desde `TOOL_PARAM_RANGES`.
 */
const ranged = (range: OperationRange, description: string) => ({
  type: range.integer ? 'integer' : 'number',
  description,
  minimum: range.min,
  maximum: range.max,
});

/** Vector [x, y, z] con cada componente en `range`. */
const vec3 = (range: OperationRange, description: string) => ({
  type: 'array',
  description,
  minItems: 3,
  maxItems: 3,
  items: { type: 'number', minimum: range.min, maximum: range.max },
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
    description: 'Obtiene el listado de objetos actuales en la escena, dimensiones en mm, selección y unidad activa. Ejes como en los slicers: X derecha, Y fondo, Z arriba (altura).',
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
        fontSize: dim('fontSize', 'Alto de mayúscula del texto en mm (type=text).'),
        letterSpacing: dim('letterSpacing', 'Espacio extra entre letras en mm (type=text).'),
        textAlign: { type: 'string', enum: [...TEXT_ALIGN_OPTIONS], description: 'Alineación de las líneas del texto (type=text).' },
        name: { type: 'string', description: 'Nombre descriptivo opcional.' },
        color: { type: 'string', description: 'Color hexadecimal #rrggbb opcional.' },
        placement: {
          type: 'string',
          enum: ['free', 'origin'],
          description: "'free' (por defecto en el chat): primer hueco libre de la cama sin solaparse; 'origin': centro de la cama.",
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'update_primitive_params',
    description:
      'Cambia los parámetros de una primitiva o rosca ya creada (radio, altura, segmentos, texto, diámetro, paso, largo) y regenera su malla conservando posición, color y nombre.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID del objeto (si se omite usa el seleccionado).' },
        width: dim('width', 'Ancho en mm.'),
        height: dim('height', 'Altura en mm.'),
        depth: dim('depth', 'Profundidad en mm.'),
        radius: dim('radius', 'Radio en mm.'),
        outerRadius: dim('outerRadius', 'Radio exterior en mm.'),
        innerRadius: dim('innerRadius', 'Radio interior en mm.'),
        tubeRadius: dim('tubeRadius', 'Radio del tubo del toro en mm.'),
        segments: dim('segments', 'Segmentos de la circunferencia.'),
        sides: dim('sides', 'Lados del prisma.'),
        fontSize: dim('fontSize', 'Alto de mayúscula del texto en mm.'),
        letterSpacing: dim('letterSpacing', 'Espacio extra entre letras del texto en mm.'),
        textAlign: { type: 'string', enum: [...TEXT_ALIGN_OPTIONS], description: 'Alineación de las líneas del texto.' },
        text: { type: 'string', description: 'Texto nuevo si es texto 3D.', maxLength: PRIMITIVE_LIMITS.maxTextLength },
        diameterMm: ranged(OR.thread.diameterMm, 'Diámetro nominal de la rosca en mm.'),
        pitchMm: ranged(OR.thread.pitchMm, 'Paso de la rosca en mm.'),
        lengthMm: ranged(OR.thread.lengthMm, 'Largo roscado en mm.'),
        clearanceMm: ranged(OR.thread.clearanceMm, 'Holgura radial en mm.'),
      },
    },
  },
  {
    name: 'transform_object',
    description: 'Mueve, rota, escala, centra o apoya un objeto en la cama (Z=0). Ejes como en los slicers: X derecha, Y fondo, Z arriba.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID del objeto (si se omite usa el seleccionado).' },
        position: vec3(TRANSFORM_RANGES.position, '[x, y, z] en mm; z es la altura sobre la cama.'),
        rotation: vec3(TRANSFORM_RANGES.rotation, '[rx, ry, rz] en radianes (Euler XYZ); rz gira sobre la cama.'),
        scale: vec3(TRANSFORM_RANGES.scale, '[sx, sy, sz]; cada factor entre 0.001 y 1000.'),
        dropToBed: { type: 'boolean', description: 'Si es true, apoya la base del objeto en Z=0.' },
        centerOnBed: { type: 'boolean', description: 'Si es true, centra el objeto en X=0, Y=0 sobre la cama.' },
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
        wallThickness: ranged(OR.hollow.wallThickness, 'Grosor de pared en mm (ej. 2.0).'),
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
        axis: { type: 'string', enum: ['x', 'y', 'z'], description: "Eje normal al plano; 'z' (por defecto) corta en horizontal." },
        offset: ranged(OR.cut.offset, 'Desplazamiento del plano respecto al centro en mm, a lo largo del eje.'),
        connectorType: { type: 'string', enum: ['none', 'dowel', 'peg', 'dovetail'] },
        connectorCount: ranged(OR.cut.connectorCount, 'Cantidad de conectores (entero).'),
        tolerance: ranged(OR.cut.tolerance, 'Holgura de encaje en mm.'),
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
        depth: ranged(OR.texture.depth, 'Profundidad del relieve en mm.'),
        scale: ranged(OR.texture.scale, 'Escala del patrón en mm (mayor que 0).'),
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
    description: 'Exporta la escena multicolor en formato 3MF estándar (compatible con OrcaSlicer, Bambu Studio, PrusaSlicer y Cura).',
    parameters: {
      type: 'object',
      properties: { onlySelected: { type: 'boolean' } },
    },
  },
];

/**
 * Rango original (con mínimo exclusivo y enteros) de cada parámetro numérico por herramienta, para que
 * `toolValidation` aplique exactamente lo mismo que el Command Bus. Las primitivas usan `primitiveLimits`.
 */
export const TOOL_PARAM_RANGES: Partial<Record<KuraCommandRequest['command'], Record<string, OperationRange>>> = {
  transform_object: TRANSFORM_RANGES,
  hollow_object: { wallThickness: OR.hollow.wallThickness },
  update_primitive_params: { diameterMm: OR.thread.diameterMm, pitchMm: OR.thread.pitchMm, lengthMm: OR.thread.lengthMm, clearanceMm: OR.thread.clearanceMm },
  plane_cut: { offset: OR.cut.offset, connectorCount: OR.cut.connectorCount, tolerance: OR.cut.tolerance },
  apply_texture: { depth: OR.texture.depth, scale: OR.texture.scale },
};
