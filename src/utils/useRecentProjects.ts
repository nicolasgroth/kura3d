/**
 * @file src/utils/useRecentProjects.ts
 * @description Lista de proyectos recientes para el menú Proyecto. En escritorio sale del registro
 * persistente de Rust (reabrir con un clic por id); en web, de `localStorage` (solo nombre y fecha). En ambos,
 * la descripción corta y la fecha de modificación vienen de `recentProjectInfo.ts` (por nombre de archivo).
 * Se refresca al abrir/guardar un proyecto y cuando el menú lo pide.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearNativeRecents, listNativeRecents, removeNativeRecent, setNativeRecentsEnabled } from '../project/nativeRecents';
import { useKuraStore } from '../store/useKuraStore';
import { isTauriRuntime } from './platformBridge';
import { clearRecentInfo, loadRecentInfo, rememberRecentInfo } from './recentProjectInfo';
import {
  addRecentProject,
  clearRecentProjects,
  isRecentRememberEnabled,
  loadRecentProjects,
  setRecentRememberEnabled,
} from './recentProjects';

export interface RecentEntry {
  /** Id nativo (solo escritorio); en web es el nombre. */
  id: string;
  name: string;
  folder?: string;
  openedAt: number;
  /** En web siempre es `true` (no hay ruta que verificar). */
  exists: boolean;
  /** Descripción corta del proyecto (nunca las notas). */
  description?: string;
  /** ISO 8601 UTC del último guardado del proyecto. */
  modifiedAt?: string;
}

export interface RecentProjectsView {
  desktop: boolean;
  enabled: boolean;
  entries: RecentEntry[];
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  /** Activa o desactiva el recuerdo; al desactivarlo se borra el registro. */
  setEnabled: (enabled: boolean) => Promise<void>;
}

/** Agrega descripción y fecha de modificación recordadas por nombre de archivo. */
function withInfo(items: RecentEntry[]): RecentEntry[] {
  const info = loadRecentInfo();
  return items.map((item) => (info[item.name] ? { ...item, ...info[item.name] } : item));
}

function webEntries(): RecentEntry[] {
  return withInfo(loadRecentProjects().map((item) => ({ id: item.name, name: item.name, openedAt: item.openedAt, exists: true })));
}

export function useRecentProjects(): RecentProjectsView {
  const desktop = isTauriRuntime();
  const [enabled, setEnabled] = useState(() => (desktop ? true : isRecentRememberEnabled()));
  const [entries, setEntries] = useState<RecentEntry[]>(() => (desktop ? [] : webEntries()));
  const alive = useRef(true);
  // Se marca vivo al montar (y no solo al crear la referencia): en modo estricto React monta, desmonta y vuelve a montar.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const apply = useCallback((next: { enabled: boolean; items: RecentEntry[] }) => {
    if (!alive.current) return;
    setEnabled(next.enabled);
    setEntries(withInfo(next.items));
  }, []);

  const refresh = useCallback(async () => {
    if (!desktop) {
      apply({ enabled: isRecentRememberEnabled(), items: webEntries() });
      return;
    }
    try {
      apply(await listNativeRecents());
    } catch {
      // Sin registro nativo disponible la lista queda como estaba.
    }
  }, [apply, desktop]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Cada apertura o guardado correcto actualiza la lista (en web se agrega el nombre; en escritorio lo hace Rust).
  useEffect(() => useKuraStore.subscribe((state, previous) => {
    if (!state.projectName || !state.savedProject || state.savedProject === previous.savedProject) return;
    if (!desktop) addRecentProject(state.projectName);
    // Solo descripción corta y fecha (nunca las notas), y solo si el recuerdo de recientes está activo.
    if (enabledRef.current) rememberRecentInfo(state.projectName, { description: state.projectInfo.description, modifiedAt: state.projectInfo.modifiedAt });
    void refresh();
  }), [desktop, refresh]);

  const remove = useCallback(async (id: string) => {
    if (!desktop) return;
    try {
      apply(await removeNativeRecent(id));
    } catch {
      await refresh();
    }
  }, [apply, desktop, refresh]);

  const clear = useCallback(async () => {
    clearRecentInfo();
    if (!desktop) {
      clearRecentProjects();
      apply({ enabled: isRecentRememberEnabled(), items: [] });
      return;
    }
    try {
      apply(await clearNativeRecents());
    } catch {
      await refresh();
    }
  }, [apply, desktop, refresh]);

  const changeEnabled = useCallback(async (next: boolean) => {
    if (!next) clearRecentInfo();
    if (!desktop) {
      setRecentRememberEnabled(next);
      apply({ enabled: next, items: next ? webEntries() : [] });
      return;
    }
    try {
      apply(await setNativeRecentsEnabled(next));
    } catch {
      await refresh();
    }
  }, [apply, desktop, refresh]);

  return { desktop, enabled, entries, refresh, remove, clear, setEnabled: changeEnabled };
}
