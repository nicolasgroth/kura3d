/**
 * @file src/store/slices/documentSlice.ts
 * @description Slice de documento: estado del motor, escena, historial y proyecto `.kura`
 * (nuevo, abrir, recuperar borrador, guardar, confirmar descarga) e inicialización del motor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import { decodeProjectAsync, encodeProjectAsync } from '../../project/projectCodecClient';
import { openProjectFile, saveProjectFile, SaveNotConfirmedError } from '../../project/projectFiles';
import { moveRecoveryDraft } from '../../project/projectRecoveryStorage';
import { loadRecoveryDocument } from '../../project/recoveryDraftStore';
import type { ProjectDocument } from '../../project/projectSchema';
import { captureProject, hasProjectChanged, makeProjectDraftId } from '../projectDocument';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Evita doble inicialización concurrente del módulo WASM en React StrictMode. */
let engineInitPromise: Promise<void> | null = null;

export function createDocumentSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, projectErrorMessage } = ctx;

  const canChangeDocument = () => {
    const state = get();
    return state.engineReady && !state.busyOperation && !state.aiBusy && !ctx.runtime.transformSnapshotBeforeDrag;
  };

  const replaceProject = (
    document: ProjectDocument,
    name: string | null,
    { location, recoveredDraftId }: { location?: string; recoveredDraftId?: string } = {},
  ) => {
    ctx.runtime.paintStroke = { open: false, recorded: false };
    ctx.runtime.livePaint = null;
    // La vista de sección es un estado de visualización: abrir un proyecto o recuperar un borrador
    // no la reactiva (ni su aviso "Salir de la sección").
    document = { ...document, sectionPlane: { ...document.sectionPlane, enabled: false } };
    set((state) => ({
      ...document,
      groups: document.groups ?? [],
      groupContextId: null,
      temporarySectionView: null,
      projectName: name,
      projectLocation: location,
      projectDraftId: recoveredDraftId ?? makeProjectDraftId(),
      projectRecovered: Boolean(recoveredDraftId),
      savedProject: document,
      pendingDownloadSave: null,
      activeTool: 'select',
      transformMode: 'translate',
      activePrintReport: null,
      showOverhangs: false,
      activeSegmentation: null,
      activeDialog: null,
      commandPaletteOpen: false,
      cutPreview: { ...state.cutPreview, active: false, objectId: null },
      spawnedAtById: {},
      cameraRequest: { preset: 'scene', nonce: (state.cameraRequest?.nonce ?? 0) + 1 },
    }));
  };

  return {
    engineReady: false,
    engineError: null,
    busyOperation: null,
    busyProgress: null,
    cancelBusyOperation: () => ctx.cancelBusyOperation(),
    lastOperationError: null,

    objects: [],
    selectedIds: [],
    groups: [],
    groupContextId: null,
    past: [],
    future: [],
    projectName: null,
    projectDraftId: makeProjectDraftId(),
    projectRecovered: false,
    savedProject: null,
    pendingDownloadSave: null,
    projectBusy: false,

    newProject: () => {
      if (get().projectBusy || !canChangeDocument()) return false;
      replaceProject({
        ...captureProject(get()),
        objects: [],
        selectedIds: [],
        groups: [],
        past: [],
        future: [],
        sectionPlane: { enabled: false, heightMm: 25 },
      }, null);
      return true;
    },

    openProject: async (loadFile = openProjectFile) => {
      if (get().projectBusy || !canChangeDocument()) return false;
      set({ projectBusy: true });
      try {
        const file = await loadFile();
        if (!file) return false;
        const document = await decodeProjectAsync(file.bytes);
        if (!canChangeDocument()) throw new Error(tr('fileProject.busy'));
        replaceProject(document, file.name, { location: file.location });
        get().addToast(tr('fileProject.opened', { name: file.name }), 'success');
        return true;
      } catch (error) {
        get().addToast(tr('fileProject.openError', { message: projectErrorMessage(error) }), 'error');
        return false;
      } finally {
        set({ projectBusy: false });
      }
    },

    recoverProject: async (draft) => {
      if (get().projectBusy || !canChangeDocument()) return false;
      set({ projectBusy: true });
      try {
        // Lee el borrador v2 (manifiesto + bloques) o uno antiguo v1 (un .kura entero).
        const stored = await loadRecoveryDocument(draft.id);
        if (!stored || stored.updatedAt !== draft.updatedAt) {
          throw new Error(tr('recovery.status.changedElsewhere'));
        }
        const { document } = stored;
        if (!canChangeDocument()) throw new Error(tr('fileProject.busy'));

        const previousState = get();
        const previousDocument = captureProject(previousState);
        const recoveredDraftId = makeProjectDraftId();
        if (!(await moveRecoveryDraft(draft, recoveredDraftId))) {
          throw new Error(tr('recovery.status.changedElsewhere'));
        }
        const state = get();
        if (state.projectDraftId !== previousState.projectDraftId ||
            hasProjectChanged(previousDocument, state) || !canChangeDocument()) {
          // The moved draft retains its bytes if the scene received a concurrent edit.
          throw new Error(tr('recovery.status.sceneChanged'));
        }
        replaceProject(document, stored.name, { recoveredDraftId });
        get().addToast(tr('recovery.status.restored'), 'success');
        return true;
      } catch (error) {
        get().addToast(tr('recovery.status.restoreFailed', { message: projectErrorMessage(error) }), 'error');
        return false;
      } finally {
        set({ projectBusy: false });
      }
    },

    acknowledgeDownloadSave: () => {
      const pending = get().pendingDownloadSave;
      if (!pending) return;
      set({ projectName: pending.name, savedProject: pending.document, projectRecovered: false, pendingDownloadSave: null });
    },

    saveProject: async (saveAs = false) => {
      if (get().projectBusy) return false;
      if (!canChangeDocument()) {
        // Nunca en silencio: el usuario pidió guardar y debe saber por qué no ocurrió.
        get().addToast(tr('fileProject.busy'), 'info');
        return false;
      }
      set({ projectBusy: true });
      try {
        const state = get();
        const document = captureProject(state);
        const name = state.projectName ?? `${tr('app.untitled')}.kura`;
        const saved = await saveProjectFile(
          name,
          () => encodeProjectAsync(document),
          saveAs ? undefined : state.projectLocation,
        );
        if (!saved) {
          get().addToast(tr('uxEscena.saveCancelled'), 'info');
          return false;
        }
        if (saved.viaDownload) {
          set({ pendingDownloadSave: { name: saved.name, document } });
          get().addToast(tr('uxEscena.savedDownload', { name: saved.name }), 'info');
          return true;
        }
        set({ projectName: saved.name, projectLocation: saved.location, savedProject: document, projectRecovered: false, pendingDownloadSave: null });
        get().addToast(tr('fileProject.saved', { name: saved.name }), 'success');
        return true;
      } catch (error) {
        if (error instanceof SaveNotConfirmedError) {
          // El proyecto sigue con cambios sin guardar; solo se avisa.
          get().addToast(tr('fileProject.saveNotConfirmed'), 'info');
          return false;
        }
        get().addToast(tr('fileProject.saveError', { message: projectErrorMessage(error) }), 'error');
        return false;
      } finally {
        set({ projectBusy: false });
      }
    },

    initEngine: async () => {
      if (get().engineReady) return;
      if (engineInitPromise) return engineInitPromise;

      engineInitPromise = (async () => {
        try {
          await engine.initManifoldEngine();
          set({ engineReady: true, engineError: null, savedProject: captureProject(get()) });
          // Sin toast: el estado del motor ya se ve en la barra de estado (avisarlo en cada carga era ruido).
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Libera la promesa para que la próxima llamada reintente en vez de reutilizar el fallo.
          engineInitPromise = null;
          set({ engineReady: false, engineError: message });
          get().addToast(tr('toast.errorPrefix', { message }), 'error');
        }
      })();

      return engineInitPromise;
    },
  };
}
