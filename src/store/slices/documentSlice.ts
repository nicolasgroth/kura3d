/**
 * @file src/store/slices/documentSlice.ts
 * @description Slice de documento: estado del motor, escena, historial y proyecto `.kura`
 * (nuevo, abrir, recuperar borrador, guardar con avance en la barra del visor, confirmar descarga) e inicialización del motor. Al abrir o
 * recuperar avisa si hay placas que se pisan (no las mueve).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { projectBed } from '../../core/scene/activePlateBed';
import { overlappingPlates } from '../../core/scene/plateOverlap';
import * as engine from '../../engine';
import { decodeProjectAsync, encodeProjectAsync, prewarmProjectCodec } from '../../project/projectCodecClient';
import { normalizeFileName, openProjectFile, PROJECT_NAME_MAX, saveProjectFile, SaveNotConfirmedError } from '../../project/projectFiles';
import { moveRecoveryDraft } from '../../project/projectRecoveryStorage';
import { loadRecoveryDocument } from '../../project/recoveryDraftStore';
import type { ProjectDocument } from '../../project/projectSchema';
import { compactInfo, infoNow, type ProjectInfo } from '../../project/projectInfo';
import { applyProjectInfoPatch } from '../../project/projectInfoPatch';
import { revealProjectNotes } from '../../utils/projectNotesFocus';
import { captureProject, hasProjectChanged, makeProjectDraftId } from '../projectDocument';
import { nextFrame, trackSaveProgress } from '../saveProgress';
import { isTauriRuntime } from '../../utils/platformBridge';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Evita doble inicialización concurrente del módulo WASM en React StrictMode. */
let engineInitPromise: Promise<void> | null = null;

/** Datos del proyecto que viven en el store (el tiempo de trabajo va aparte para no marcar cambios). */
const storedInfo = (info: ProjectInfo | undefined): Omit<ProjectInfo, 'workSeconds'> => {
  const { workSeconds: _work, ...rest } = info ?? {};
  return rest;
};

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
    // Los mensajes del proyecto anterior no viajan al nuevo; se limpia antes de que la apertura emita los suyos.
    get().resetMessages();
    ctx.runtime.paintStroke = { open: false, recorded: false };
    ctx.runtime.livePaint = null;
    // La vista de sección es un estado de visualización: abrir un proyecto o recuperar un borrador
    // no la reactiva (ni su aviso "Salir de la sección").
    document = { ...document, sectionPlane: { ...document.sectionPlane, enabled: false } };
    set((state) => ({
      ...document,
      groups: document.groups ?? [],
      plates: document.plates ?? [],
      layout: document.layout ?? 'print',
      activePlateId: null,
      groupContextId: null,
      temporarySectionView: null,
      projectName: name,
      // Abrir no cambia fechas: un archivo sin fecha queda sin ella (no se inventa).
      projectInfo: storedInfo(document.info),
      projectWorkSeconds: document.info?.workSeconds ?? 0,
      projectLocation: location,
      projectDraftId: recoveredDraftId ?? makeProjectDraftId(),
      projectRecovered: Boolean(recoveredDraftId),
      projectRenamed: false,
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

  /** Aviso discreto (no un modal) al abrir o recuperar un proyecto con notas, con «Ver notas». */
  const noticeNotes = () => {
    if (!get().projectInfo.notes?.trim()) return;
    get().addToast(tr('projectInfo.notesNotice'), 'info', {
      label: tr('projectInfo.notesView'),
      ariaLabel: tr('projectInfo.notesViewAria'),
      run: () => revealProjectNotes(get().showProjectPanel),
      transient: true,
    });
  };

  /** Placas del archivo que se pisan: no se recolocan (ver `plateOverlap.ts`), se avisa con sus nombres. */
  const warnOverlappingPlates = () => {
    const state = get();
    const pairs = overlappingPlates(state.plates, projectBed(state));
    if (pairs.length === 0) return;
    const name = (id: string) => state.plates.find((p) => p.id === id)?.name ?? id;
    const names = pairs.map(([a, b]) => `${name(a)} / ${name(b)}`).join(', ');
    get().addToast(tr('plates.overlap.opened', { names }), 'info');
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
    projectRenamed: false,
    // Un proyecto nuevo (también el vacío del arranque) nace con su fecha de creación.
    projectInfo: { createdAt: infoNow() },
    projectWorkSeconds: 0,
    savedProject: null,
    pendingDownloadSave: null,
    projectBusy: false,

    setProjectInfo: (patch) => {
      if (get().projectBusy) return false;
      // Misma regla que el modo sin interfaz del servidor MCP (`applyProjectInfoPatch`).
      const { next, changed } = applyProjectInfoPatch(get().projectInfo, patch);
      if (changed) set({ projectInfo: next });
      return changed;
    },

    addProjectWorkSeconds: (seconds) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      set((state) => ({ projectWorkSeconds: Math.floor(state.projectWorkSeconds + seconds) }));
    },

    renameProject: (input) => {
      if (get().projectBusy || !input.trim()) return false;
      const name = normalizeFileName(input.trim().slice(0, PROJECT_NAME_MAX));
      if (name === get().projectName) return true;
      // Otro nombre es otro archivo: el próximo guardado pregunta dónde (no sobrescribe el anterior).
      set({ projectName: name, projectLocation: undefined, projectRenamed: true });
      return true;
    },

    newProject: () => {
      if (get().projectBusy || !canChangeDocument()) return false;
      replaceProject({
        ...captureProject(get()),
        objects: [],
        selectedIds: [],
        groups: [],
        plates: [],
        layout: 'print',
        past: [],
        future: [],
        sectionPlane: { enabled: false, heightMm: 25 },
        info: { createdAt: infoNow() },
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
        noticeNotes();
        warnOverlappingPlates();
        get().offerPreferredBed();
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
        noticeNotes();
        warnOverlappingPlates();
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
      set((state) => ({
        projectName: pending.name, savedProject: pending.document, projectRecovered: false, projectRenamed: false, pendingDownloadSave: null,
        // La descarga quedó confirmada: esa es la fecha de guardado; lo escrito después se conserva.
        projectInfo: { ...state.projectInfo, ...(pending.document.info?.modifiedAt ? { modifiedAt: pending.document.info.modifiedAt } : {}) },
      }));
    },

    saveProject: async (saveAs = false) => {
      if (get().projectBusy) return false;
      if (!canChangeDocument()) {
        // Nunca en silencio: el usuario pidió guardar y debe saber por qué no ocurrió.
        get().addToast(tr('fileProject.busy'), 'info');
        return false;
      }
      set({ projectBusy: true });
      const progress = trackSaveProgress(get, set);
      try {
        const state = get();
        // La fecha de modificación se fija al guardar (no al abrir ni al editar).
        const withDate = compactInfo({ ...state.projectInfo, workSeconds: state.projectWorkSeconds, modifiedAt: infoNow() });
        const document = { ...captureProject(state), ...(withDate ? { info: withDate } : {}) };
        const name = state.projectName ?? `${tr('app.untitled')}.kura`;
        const saved = await saveProjectFile(
          name,
          async () => {
            // Se llama ya elegido el archivo (en la web, después del selector): el avance arranca aquí, antes del
            // Worker, y se cede un cuadro para que la interfaz pinte antes de copiar el proyecto al Worker.
            progress.update(0, 'encode');
            await nextFrame();
            const bytes = await encodeProjectAsync(document, progress.update);
            // En escritorio, sin ubicación conocida, el diálogo nativo se abre DESPUÉS de codificar: ahí no hay avance.
            if (isTauriRuntime() && (saveAs || !state.projectLocation)) progress.end();
            else progress.writing();
            return bytes;
          },
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
        set((current) => ({
          projectName: saved.name, projectLocation: saved.location, savedProject: document, projectRecovered: false, projectRenamed: false, pendingDownloadSave: null,
          projectInfo: { ...current.projectInfo, ...(document.info?.modifiedAt ? { modifiedAt: document.info.modifiedAt } : {}) },
        }));
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
        progress.end();
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
          // El Worker del códec arranca ahora (en segundo plano): el primer guardado no paga su carga.
          prewarmProjectCodec();
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
