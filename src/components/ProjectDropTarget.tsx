import { useEffect, useState } from 'react';
import { FileUp } from 'lucide-react';
import { t } from '../i18n';
import { MAX_PROJECT_BYTES, ProjectCodecError } from '../project/projectSchema';
import { useKuraStore } from '../store/useKuraStore';
import { isTauriRuntime } from '../utils/platformBridge';
import '../styles/projectDrop.css';

interface DroppedFile {
  name: string;
  read: (remaining: number) => Promise<ArrayBuffer>;
}

function verifySize(size: number, maximum: number) {
  if (size > maximum) throw new ProjectCodecError('too-large');
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
    await state.openProject(async () => ({
      name: file.name,
      bytes: new Uint8Array(await file.read(MAX_PROJECT_BYTES)),
    }));
    return;
  }
  if (!files.every((file) => /\.(stl|3mf|obj)$/i.test(file.name))) {
    state.addToast(t(state.language, 'dropProject.unsupported'), 'error');
    return;
  }

  let remaining = MAX_PROJECT_BYTES;
  await state.importModelFiles(files.map((file) => ({
    name: file.name,
    async read() {
      const buffer = await file.read(remaining);
      verifySize(buffer.byteLength, remaining);
      remaining -= buffer.byteLength;
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
            async read(remaining) {
              const info = await stat(path);
              if (!info.isFile) throw new Error(t(useKuraStore.getState().language, 'dropProject.notFile'));
              verifySize(info.size, remaining);
              const bytes = await readFile(path);
              verifySize(bytes.byteLength, remaining);
              return new Uint8Array(bytes).buffer;
            },
          })));
        });
        if (disposed) unlisten();
        else stopListening = unlisten;
      };
      void register().catch((error) => console.error('[Kura3D] File drop:', error));
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
        read(remaining) {
          verifySize(file.size, remaining);
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
