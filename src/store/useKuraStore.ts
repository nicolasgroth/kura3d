/**
 * @file src/store/useKuraStore.ts
 * @description Store central Zustand de Kura3D: compone los slices por responsabilidad
 * (documento, historial, selección y transformación, interfaz y preferencias, IA y MCP,
 * importación/exportación y operaciones geométricas) y el Command Bus unificado para UI, servidor
 * MCP y chat IA. La lógica de escena vive en `src/core`; aquí solo se ensambla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import { createCommandBus } from './commandBus';
import { createStoreContext } from './storeContext';
import type { KuraStoreState } from './storeTypes';
import { createAiMcpSlice, hydrateSecrets } from './slices/aiMcpSlice';
import { createCreationSlice } from './slices/creationSlice';
import { createDocumentSlice } from './slices/documentSlice';
import { createGeometrySlice } from './slices/geometrySlice';
import { createHistorySlice } from './slices/historySlice';
import { createIoSlice } from './slices/ioSlice';
import { createPartsSlice } from './slices/partsSlice';
import { clearPreviewOnSelectionChange, createPreviewSlice } from './slices/previewSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createUiSlice } from './slices/uiSlice';

export type {
  ActiveDialogType,
  CameraPresetType,
  CommandSourceType,
  KuraStoreState,
  PaintBrushMode,
  SettingsTabType,
  ToastMessage,
} from './storeTypes';
export { captureProject, isProjectDirty } from './projectDocument';
/** Genera un token hexadecimal aleatorio seguro (re-exportado desde `utils/mcpTokenStore`). */
export { generateRandomTokenHex } from '../utils/mcpTokenStore';

/** Convierte un Uint8Array a Base64 de forma segura tanto en navegador como en Node.js. */
function uint8ToBase64(bytes: Uint8Array): string {
  const globalBuf = (
    globalThis as { Buffer?: { from: (arr: Uint8Array) => { toString: (enc: string) => string } } }
  ).Buffer;
  if (globalBuf) return globalBuf.from(bytes).toString('base64');
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export const useKuraStore = create<KuraStoreState>((rawSet, get) => {
  const ctx = createStoreContext(rawSet, get);
  return {
    ...createDocumentSlice(ctx),
    ...createUiSlice(ctx),
    ...createAiMcpSlice(ctx),
    ...createHistorySlice(ctx),
    ...createSelectionSlice(ctx),
    ...createCreationSlice(ctx),
    ...createGeometrySlice(ctx),
    ...createPartsSlice(ctx),
    ...createIoSlice(ctx),
    ...createPreviewSlice(ctx),
    executeCommand: createCommandBus({
      get,
      setSelectedIds: (ids) => ctx.set({ selectedIds: ids }),
      isInteractionLocked: () => ctx.isHistoryLocked(),
      tr: ctx.tr,
      toBase64: uint8ToBase64,
      operationErrors: ctx.operationErrors,
    }),
  } as KuraStoreState;
});

hydrateSecrets(useKuraStore);
clearPreviewOnSelectionChange(useKuraStore);
