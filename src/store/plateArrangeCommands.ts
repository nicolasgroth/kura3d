/**
 * @file src/store/plateArrangeCommands.ts
 * @description Comando `arrange_on_plates` del Command Bus («Repartir en placas», lote P5): esquema de parámetros
 * (`ids`, `criterion`, `spacingMm`, `marginMm`, `orient`, `plateIds`, `dryRun`, en `core/bus/plateArrangeSchema.ts`) y manejador. Con `dryRun` devuelve el
 * plan y el informe sin tocar escena ni historial; sin él lo aplica en un paso de deshacer. Usa las mismas acciones
 * del store que el diálogo. El MCP sin interfaz usa el mismo esquema (`mcp-server/src/headlessPlates.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { arrangeReportToUser, parseArrangeOnPlates } from '../core/bus/plateArrangeSchema';
import { CommandError } from './commandErrors';
import type { RawParams } from './commandValidation';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

const failed = () => new CommandError('failed', 'bus.error.failed', { command: 'arrange_on_plates' });

export const PLATE_ARRANGE_HANDLERS = {
  arrange_on_plates: async (p: RawParams, { get }: Deps) => {
    const request = parseArrangeOnPlates(get(), p);
    if (request.dryRun) {
      const preview = await get().planArrangeOnPlates(request.options);
      if (!preview) throw failed();
      return {
        dryRun: true,
        ...arrangeReportToUser(preview.report),
        // Destino de cada objeto que se movería (ids de placa existentes, `implicit` o claves `new:N`).
        assignments: preview.plan.placements.map((pl) => ({ id: pl.id, plate: pl.plate })),
      };
    }
    const report = await get().arrangeOnPlatesApply(request.options);
    if (!report) throw failed();
    return {
      dryRun: false,
      ...arrangeReportToUser(report),
      assignments: get().objects.filter((o) => report.placed.includes(o.id)).map((o) => ({ id: o.id, plate: o.plateRef ?? null })),
    };
  },
};

export { arrangeReportToUser, parseArrangeOnPlates, type ArrangeOnPlatesRequest } from '../core/bus/plateArrangeSchema';
