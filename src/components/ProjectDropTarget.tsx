/**
 * @file src/components/ProjectDropTarget.tsx
 * @description Zona de arrastrar y soltar sobre la ventana: abre un proyecto .kura o importa un lote
 * de modelos (STL, 3MF, OBJ+MTL, PLY) de forma parcial, con validación de tamaño, en navegador y en Tauri.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, useState } from 'react';
import { FileUp } from 'lucide-react';
import { t } from '../i18n';
import * as engine from '../engine';
import { MODEL_IO_LIMITS } from '../engine/operationLimits';
import { MAX_PROJECT_BYTES, ProjectCodecError } from '../project/projectSchema';
import { useKuraStore } from '../store/useKuraStore';
import { isTauriRuntime } from '../utils/platformBridge';
import { guardUnsavedChanges } from '../utils/unsavedGuard';
import { LOG_TAG } from '../brand';
import '../styles/projectDrop.css';

interface DroppedFile {
  name: string;
  /** `model`: el archivo es un modelo (el error de tamaño lleva el tamaño y el máximo). */
  read: (maximum: number, model?: boolean) => Promise<ArrayBuffer>;
}

/** Proyectos: `ProjectCodecError`; modelos: `ModelImportError` con el tamaño y el máximo (mensaje claro). */
function verifySize(size: number, maximum: number, name: string, model = false) {
  if (size <= maximum) return;
  if (model) throw new engine.ModelImportError('too-large', undefined, name, { bytes: size, maxBytes: maximum });
  throw new ProjectCodecError('too-large');
}

async function acceptDrop(files: DroppedFile[]) {
  const state = useKuraStore.getState();
  if (files.length === 0) return;
  if (state.activeDialog || state.commandPaletteOpen || state.projectBusy || state.busyOperation || state.aiBusy) {
    state.addToast(t(state.language, 'fileProject.busy'), 'info');
    return;
  }
  if (files.length === 1 && /\.kura$/i.test(files[0].name)) {
    if (!state.engineReady) {
      state.addToast(t(state.language, 'fileProject.busy'), 'info');
      return;
    }
    const file = files[0];
    await guardUnsavedChanges(() => state.openProject(async () => ({
      name: file.name,
      bytes: new Uint8Array(await file.read(MAX_PROJECT_BYTES)),
    })));
    return;
  }
  // Lote parcial: los archivos no soportados o dañados se informan por nombre y el resto se importa.
  if (!files.some((file) => /\.(stl|3mf|obj|ply)$/i.test(file.name))) {
    state.addToast(t(state.language, 'dropProject.unsupported'), 'error');
    return;
  }

  // Cada modelo puede pesar lo que la app sabe exportar y reabrir (`MODEL_IO_LIMITS`), no el tope de proyectos.
  const maximum = MODEL_IO_LIMITS.maxFileBytes;
  await state.importModelFiles(files.map((file) => ({
    name: file.name,
    async read() {
      const buffer = await file.read(maximum, true);
      verifySize(buffer.byteLength, maximum, file.name, true);
      return buffer;
    },
  })));
}

export function ProjectDropTarget() {
  const language = useKuraStore((state) => state.language);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (isTauriRuntime()) {
      let disposed = false;
      let stopListening: (() => void) | undefined;
      const register = async () => {
        const [{ getCurrentWebview }, { readFile, stat }] = await Promise.all([
          import('@tauri-apps/api/webview'),
          import('@tauri-apps/plugin-fs'),
        ]);
        if (disposed) return;
        const unlisten = await getCurrentWebview().onDragDropEvent(({ payload }) => {
          if (payload.type !== 'drop') {
            setDragging(payload.type !== 'leave');
            return;
          }
          setDragging(false);
          void acceptDrop(payload.paths.map((path) => ({
            name: path.split(/[\\/]/).at(-1) ?? '',
            async read(maximum, model) {
              const name = path.split(/[\\/]/).at(-1) ?? '';
              const info = await stat(path);
              if (!info.isFile) throw new Error(t(useKuraStore.getState().language, 'dropProject.notFile'));
              verifySize(info.size, maximum, name, model);
              const bytes = await readFile(path);
              verifySize(bytes.byteLength, maximum, name, model);
              return new Uint8Array(bytes).buffer;
            },
          })));
        });
        if (disposed) unlisten();
        else stopListening = unlisten;
      };
      void register().catch((error) => console.error(`${LOG_TAG} File drop:`, error));
      return () => {
        disposed = true;
        stopListening?.();
      };
    }

    let depth = 0;
    const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files');
    const onEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      if (!event.dataTransfer || !carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };
    const clear = () => {
      depth = 0;
      setDragging(false);
    };
    const onLeave = () => {
      if (depth === 0) return;
      depth -= 1;
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      clear();
      if (!files.length && !carriesFiles(event)) return;
      event.preventDefault();
      void acceptDrop(files.map((file) => ({
        name: file.name,
        read(maximum, model) {
          verifySize(file.size, maximum, file.name, model);
          return file.arrayBuffer();
        },
      })));
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  if (!dragging) return null;
  return (
    <div className="kura-project-drop" role="status">
      <div className="kura-project-drop-label">
        <FileUp size={24} aria-hidden="true" />
        <span>{t(language, 'dropProject.prompt')}</span>
      </div>
    </div>
  );
}
