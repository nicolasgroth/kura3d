/**
 * @file mcp-server/src/faceNegativeTools.ts
 * @description Herramientas MCP `kura_add_keyhole` (ojo de cerradura para colgar en el muro) y `kura_add_cable_pass`
 * (paso de cable): un negativo pendiente sobre una cara, con el mismo lugar (punto + normal o cara por nombre) que
 * `kura_add_magnet_pocket`. Con la app conectada van por el Command Bus (`add_keyhole`, `add_cable_pass`); sin
 * interfaz, por los mismos esquemas (`src/store/faceNegativeCommandSchemas`) y operaciones del motor. Un bloqueo es
 * el error tipado `addon-blocked` con su motivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CABLE_PASS_RANGES as CR } from '../../src/core/addons/cablePass';
import { CABLE_PASS_DEFAULTS as CD } from '../../src/core/addons/cablePassPresets';
import { KEYHOLE_RANGES as KR } from '../../src/core/addons/keyhole';
import { BUILTIN_KEYHOLE_PRESETS, KEYHOLE_DEFAULTS as KD } from '../../src/core/addons/keyholePresets';
import { KEYHOLE_MIN_RETENTION_RATIO } from '../../src/core/operations/keyholeRetention';
import { placementInputs } from './addonTools.js';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const presetSizes = BUILTIN_KEYHOLE_PRESETS.map((p) => p.values.screwMm).join(', ');

export function registerFaceNegativeTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_add_keyhole',
    {
      title: 'Add wall-hanging keyhole',
      description:
        'Adds a keyhole for hanging the part from a wall screw on a face of a solid part (normally the face against the wall): ' +
        'a pending negative made of the round entry for the screw head, the neck slot in the lip and the chamber behind it; the ' +
        'slot runs towards the part\'s "up" (angleDeg turns it). screwMm picks the built-in size (' + presetSizes + ' mm; default ' +
        KD.screwMm + ' mm: head ' + KD.headDiameterMm + ', neck ' + KD.neckWidthMm + ', slot ' + KD.slotLengthMm + ', chamber ' +
        KD.chamberDepthMm + ', lip ' + KD.lipMm + '); explicit sizes win. One undo step; in the app it is grouped with its part and ' +
        'follows it. Returns the negative, the report (wall behind the chamber, through, edge, vertical face, level offset vs other ' +
        'keyholes on the face, lip retention mm³ vs an infinite wall) and warnings (KEYHOLE_THROUGH, KEYHOLE_WALL, KEYHOLE_EDGE, ' +
        'KEYHOLE_LEVEL, KEYHOLE_FACE). Fails with addon-blocked: reason spansFace when it is wider than the face, notRetained when ' +
        'the lip left by the real part holds less than ' + KEYHOLE_MIN_RETENTION_RATIO * 100 + ' % of the head (face too small: the ' +
        'head would slip out).',
      inputSchema: {
        hostId: idSchema.describe('ID of the solid part that receives the keyhole.'),
        ...placementInputs,
        screwMm: rangeSchema(KR.screwMm).optional().describe(`Screw size in mm; a built-in size (${presetSizes}) sets the defaults below.`),
        headDiameterMm: rangeSchema(KR.headDiameterMm).optional().describe('Entry / chamber width for the screw head in mm.'),
        neckWidthMm: rangeSchema(KR.neckWidthMm).optional().describe('Neck slot width in mm (at least 0.5 mm narrower than the head).'),
        slotLengthMm: rangeSchema(KR.slotLengthMm).optional().describe('Slot travel in mm (≥ (head + neck) / 2).'),
        chamberDepthMm: rangeSchema(KR.chamberDepthMm).optional().describe('Chamber depth behind the lip in mm (head height).'),
        lipMm: rangeSchema(KR.lipMm).optional().describe('Lip thickness that holds the head in mm.'),
        angleDeg: rangeSchema(KR.angleDeg).optional().describe('Turn of the slot from the part "up" in degrees (default 0).'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'add_keyhole', { ...args }, () => ctx.headless.addKeyhole({ ...args })),
  );

  server.registerTool(
    'kura_add_cable_pass',
    {
      title: 'Add cable pass',
      description:
        'Adds a cable pass on a face of a solid part: a pending negative hole, round (widthMm = diameter) or slot (lengthMm × ' +
        'widthMm), with an optional entry chamfer, along the face normal. autoDepth (default ' + CD.autoDepth + ') measures the wall ' +
        'and goes through it (up to 40 mm); otherwise depthMm is used. One undo step; in the app it is grouped with its part and ' +
        'follows it. Defaults: round Ø ' + CD.widthMm + ' mm, chamfer ' + CD.chamferMm + ' mm. Returns the negative, the report ' +
        '(measured thickness, bore length, through, noExit, nearEdge, nearAddon) and warnings. Fails with addon-blocked (reason ' +
        'spansFace) when it is wider than the face.',
      inputSchema: {
        hostId: idSchema.describe('ID of the solid part that receives the cable pass.'),
        ...placementInputs,
        shape: z.enum(['round', 'slot']).optional().describe('round (default) or slot.'),
        widthMm: rangeSchema(CR.widthMm).optional().describe('Diameter (round) or short side (slot) in mm.'),
        lengthMm: rangeSchema(CR.lengthMm).optional().describe('Slot only: long side in mm (≥ widthMm).'),
        chamferMm: rangeSchema(CR.chamferMm).optional().describe('Entry chamfer in mm (0 = none).'),
        angleDeg: rangeSchema(CR.angleDeg).optional().describe('Slot turn on the face in degrees.'),
        autoDepth: z.boolean().optional().describe('Measure the wall and go through it (default true).'),
        depthMm: rangeSchema(CR.depthMm).optional().describe('Hole depth in mm when autoDepth is false (or the wall is too thick).'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'add_cable_pass', { ...args }, () => ctx.headless.addCablePass({ ...args })),
  );
}
