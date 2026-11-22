/**
 * @file src/core/__tests__/engineWorkerTaskName.test.ts
 * @description El host del Worker del motor solo acepta tareas propias de `ENGINE_TASKS`: claves
 * heredadas del prototipo (`toString`, `constructor`, `__proto__`) se rechazan con error, sin
 * llegar a inicializar el motor ni a ejecutar nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { handleEngineRequest } from '../operations/engineWorkerHost';
import type { EngineTaskRequest, EngineTaskResponse } from '../operations/engineWire';
import { APP_BUILD_POLICY } from '../scene/sceneObjects';

describe('Worker del motor: nombre de tarea', () => {
  for (const task of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'noExiste']) {
    it(`rechaza "${task}" antes de inicializar el motor`, async () => {
      const posted: EngineTaskResponse[] = [];
      await handleEngineRequest(
        { id: 1, task, args: {}, policy: APP_BUILD_POLICY } as unknown as EngineTaskRequest,
        (r) => posted.push(r),
      );
      expect(posted.map((r) => r.type)).toEqual(['error']);
      expect(JSON.stringify(posted[0])).toMatch(/Unknown engine task/);
    });
  }
});
