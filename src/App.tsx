/**
 * @file src/App.tsx
 * @description Shell principal de la aplicación Kura3D v0.5.0: inicialización del motor Manifold,
 * pantalla de bienvenida animada (SplashScreen), densidad adaptativa (Expandido / Compacto / Zen
 * con Ctrl/⌘+Shift+Enter), atajos de teclado CAD globales, puente MCP WebSocket, sincronización de tema y
 * esquema de color, y stack de notificaciones toast.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isNegative, isReference, isSolid } from './core/scene/objectRole';
import React, { useCallback, useEffect, useState } from 'react';
import { AiChatDrawer } from './components/AiChatDrawer';
import { CommandPalette } from './components/CommandPalette';
import { Dialogs } from './components/Dialogs';
import { LeftSidebar } from './components/LeftSidebar';
import { ProjectDropTarget } from './components/ProjectDropTarget';
import { ProjectRecoveryBanner } from './components/ProjectRecoveryBanner';
import { DownloadSaveNotice } from './components/DownloadSaveNotice';
import { RightInspector } from './components/RightInspector';
import { SplashScreen } from './components/SplashScreen';
import { StatusBar } from './components/StatusBar';
import { SkipLinks } from './components/SkipLinks';
import { TopBar } from './components/TopBar';
import { Viewport3D } from './components/Viewport3D';
import { t } from './i18n';
import { useProjectRecovery } from './project/useProjectRecovery';
import { isProjectDirty, useKuraStore } from './store/useKuraStore';
import type { TransformMode } from './types/kura';
import { useMcpBridgeClient } from './utils/mcpBridgeClient';
import { isTauriRuntime } from './utils/platformBridge';
import { useFunctionKeys } from './components/useFunctionKeys';
import { guardUnsavedChanges } from './utils/unsavedGuard';
import { LOG_TAG } from './brand';
import { ConfirmDialogHost } from './components/ConfirmDialogHost';
import { UnitChoiceDialog } from './components/dialogs/UnitChoiceDialog';
import { RowContextMenuHost } from './components/scene/RowContextMenuHost';
import { confirmDeleteSelection } from './components/scene/confirmDeleteSelection';
import { NarrowPanelBar } from './components/NarrowPanelBar';
import { useNarrowSheets } from './components/narrow/useNarrowSheets';
import { MobileTransformBar } from './components/narrow/MobileTransformBar';
import { OPEN_INSPECTOR_EVENT } from './components/inspector/hollowPanelRequest';
import { useSimplifyRequestRelay } from './components/inspector/simplifyPanelRequest';

const TRANSFORM_SHORTCUTS = new Map<string, TransformMode>([
  ['m', 'translate'],
  ['g', 'translate'],
  ['w', 'translate'],
  ['r', 'rotate'],
  ['s', 'scale'],
]);

export const App: React.FC = () => {
  useSimplifyRequestRelay();
  const language = useKuraStore((s) => s.language);
  const activeTool = useKuraStore((s) => s.activeTool);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const showBed = useKuraStore((s) => s.showBed);
  const projectName = useKuraStore((s) => s.projectName);
  const projectDirty = useKuraStore(isProjectDirty);
  const mcpConfig = useKuraStore((s) => s.mcpConfig);
  const initEngine = useKuraStore((s) => s.initEngine);
  const executeCommand = useKuraStore((s) => s.executeCommand);
  const setMcpConnected = useKuraStore((s) => s.setMcpConnected);
  const syncColorSchemeFromDom = useKuraStore((s) => s.syncColorSchemeFromDom);
  const [precisionRequest, setPrecisionRequest] = useState<{ mode: TransformMode } | null>(null);
  const sheets = useNarrowSheets();
  const visibleNarrowPanel = sheets.visible;
  const recovery = useProjectRecovery();
  const discardRecoveryOnClose = recovery.discardOnClose;

  // F2/F3 necesitan la lista de escena: en pantallas estrechas el panel izquierdo es un cajón.
  const revealLeftPanel = useCallback(() => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      sheets.reveal('left');
    }
  }, [sheets.reveal]);
  useFunctionKeys({ revealLeftPanel });

  // El menú contextual pide abrir el inspector (panel Ahuecar): en pantallas estrechas es una hoja.
  useEffect(() => {
    const onOpenInspector = () => sheets.reveal('right');
    window.addEventListener(OPEN_INSPECTOR_EVENT, onOpenInspector);
    return () => window.removeEventListener(OPEN_INSPECTOR_EVENT, onOpenInspector);
  }, [sheets.reveal]);

  // Sincroniza título del documento e idioma del elemento <html>
  useEffect(() => {
    document.documentElement.lang = language;
    const appTitle = t(language, 'app.docTitle');
    const name = projectName ?? t(language, 'app.untitled');
    document.title = projectName || projectDirty
      ? `${projectDirty ? '* ' : ''}${name} — ${appTitle}`
      : appTitle;
  }, [language, projectName, projectDirty]);

  useEffect(() => {
    if (!projectDirty || isTauriRuntime()) return;
    const protectProject = (event: BeforeUnloadEvent) => {
      if (!isProjectDirty(useKuraStore.getState())) return;
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener('beforeunload', protectProject);
    return () => window.removeEventListener('beforeunload', protectProject);
  }, [projectDirty]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let stopListening: (() => void) | undefined;
    let confirming = false;

    const register = async () => {
      const [{ getCurrentWindow }, { ask }] = await Promise.all([
        import('@tauri-apps/api/window'),
        import('@tauri-apps/plugin-dialog'),
      ]);
      if (disposed) return;
      const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        const state = useKuraStore.getState();
        if (confirming || state.projectBusy) {
          event.preventDefault();
          if (state.projectBusy) state.addToast(t(state.language, 'fileProject.busy'), 'info');
          return;
        }
        confirming = true;
        try {
          if (isProjectDirty(state) && !(await ask(t(state.language, 'fileProject.discard'), {
            title: t(state.language, 'fileProject.menu'), kind: 'warning',
          }))) {
            event.preventDefault();
            return;
          }
          await discardRecoveryOnClose();
        } catch (error) {
          event.preventDefault();
          state.addToast(t(state.language, 'toast.errorPrefix', { message: String(error) }), 'error');
        } finally {
          confirming = false;
        }
      });
      if (disposed) unlisten();
      else stopListening = unlisten;
    };

    void register().catch((error) => console.error(`${LOG_TAG} Project close protection:`, error));
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [discardRecoveryOnClose]);

  // Inicializa Manifold WASM para la primera operación.
  useEffect(() => {
    void initEngine();
  }, [initEngine]);

  // Conecta al puente MCP local únicamente cuando el usuario lo activa en Ajustes
  useMcpBridgeClient(mcpConfig, executeCommand, setMcpConnected);

  // Mantiene sincronizado el esquema de color y el tema WCAG si cambian desde otra pestaña
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'kura3d-color-scheme' || e.key === 'kura3d-theme-preset') {
        syncColorSchemeFromDom();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [syncColorSchemeFromDom]);

  // Atajos de teclado globales del estudio CAD
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const state = useKuraStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && !e.altKey && (key === 's' || (!e.shiftKey && (key === 'n' || key === 'o')))) {
        if (state.activeDialog !== null || state.commandPaletteOpen) return;
        e.preventDefault();
        if (e.repeat) return;
        if (key === 's') {
          const field = e.target;
          if (field instanceof HTMLInputElement && field.hasAttribute('data-commit-on-blur')) {
            field.blur();
          }
          void state.saveProject(e.shiftKey);
        }
        else if (key === 'o') void guardUnsavedChanges(() => state.openProject());
        else void guardUnsavedChanges(() => state.newProject());
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      // Con un diálogo modal abierto los atajos globales (Ctrl+Z, flechas, borrar…) no tocan la escena: dentro de
      // un campo de texto ya se retiraron arriba y ahí Ctrl+Z deshace la edición del propio campo.
      if (document.querySelector('dialog[open]:modal')) return;

      if (mod && key === 'k') {
        e.preventDefault();
        if (state.activeDialog === null) {
          state.setCommandPaletteOpen(!state.commandPaletteOpen);
        }
        return;
      }

      if (mod && e.key === ',') {
        e.preventDefault();
        state.openSettings('appearance');
        return;
      }

      if (state.activeDialog !== null || state.commandPaletteOpen) {
        return;
      }

      if (mod && e.shiftKey && !e.altKey && key === 'enter') {
        e.preventDefault();
        if (!e.repeat) state.toggleZenMode();
        return;
      }

      // Escape también sale del modo Zen (sin diálogos abiertos: esos ya consumen Escape).
      // Escape sale un nivel del grupo en el que se entró; Enter entra al grupo del objeto elegido.
      if (e.key === 'Escape' && !mod && !e.shiftKey && state.groupContextId) {
        e.preventDefault();
        state.exitGroup();
        return;
      }
      if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey && state.groups.length > 0 && state.selectedIds.length > 1) {
        if (state.enterGroup()) {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Escape' && !mod && state.uiDensity === 'zen') {
        e.preventDefault();
        state.toggleZenMode();
        return;
      }

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        return;
      }

      if (mod && key === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }

      if (mod && key === 'd') {
        e.preventDefault();
        state.duplicateObjects();
        return;
      }

      // Ctrl/⌘+G agrupa y Ctrl/⌘+Mayús+G desagrupa (convención general).
      if (mod && !e.altKey && key === 'g') {
        e.preventDefault();
        if (e.repeat) return;
        if (e.shiftKey) state.ungroupObjects();
        else state.groupObjects();
        return;
      }

      // Ctrl/⌘+Mayús+U: aplicar restas o unir sólidos (antes Ctrl+G).
      if (mod && e.shiftKey && !e.altKey && key === 'u') {
        e.preventDefault();
        if (e.repeat) return;
        {
          const selectedObjs = state.objects.filter((o) => state.selectedIds.includes(o.id));
          const selHasHole = selectedObjs.some((o) => isNegative(o) && o.visible);
          const selHasSolid = selectedObjs.some((o) => isSolid(o) && o.visible);
          const sceneHasHole = state.objects.some((o) => isNegative(o) && o.visible);
          const sceneHasSolid = state.objects.some((o) => isSolid(o) && o.visible);
          if ((selHasHole && selHasSolid) || (state.selectedIds.length < 2 && sceneHasHole && sceneHasSolid)) {
            void state.applyHolesOnSolids();
          } else if (state.selectedIds.length >= 2) {
            void state.runBooleanOnSelection('union');
          } else if (sceneHasHole && sceneHasSolid) {
            void state.applyHolesOnSolids();
          }
        }
        return;
      }

      if (mod && key === 'a') {
        e.preventDefault();
        state.selectAll();
        return;
      }

      // Empuje numérico de precisión (Arrow Keys / PageUp / PageDown) sobre selección
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'PageUp' ||
        e.key === 'PageDown'
      ) {
        const targetIds =
          state.selectedIds.length > 0
            ? state.selectedIds
            : state.objects.length === 1
              ? [state.objects[0].id]
              : [];
        if (targetIds.length > 0) {
          if (state.selectedIds.length === 0) {
            state.selectObject(targetIds[0], false);
          }
          e.preventDefault();
          const base = state.snapGridMm > 0 ? state.snapGridMm : 1;
          const step = e.shiftKey ? base * 10 : mod || e.altKey ? base * 0.2 : base;
          if (e.key === 'ArrowLeft') state.nudgeSelectedObjects([-step, 0, 0]);
          else if (e.key === 'ArrowRight') state.nudgeSelectedObjects([step, 0, 0]);
          else if (e.key === 'ArrowUp') state.nudgeSelectedObjects([0, 0, -step]);
          else if (e.key === 'ArrowDown') state.nudgeSelectedObjects([0, 0, step]);
          else if (e.key === 'PageUp') state.nudgeSelectedObjects([0, step, 0]);
          else if (e.key === 'PageDown') state.nudgeSelectedObjects([0, -step, 0]);
        }
        return;
      }

      if (mod || e.altKey) return;

      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        state.setActiveDialog('shortcuts');
        return;
      }

      if (e.shiftKey && key === 'd') {
        e.preventDefault();
        state.duplicateObjects();
        return;
      }

      const transformMode = TRANSFORM_SHORTCUTS.get(key);
      if (transformMode && !(key === 'm' && e.shiftKey)) {
        e.preventDefault();
        state.setActiveTool('select');
        state.setTransformMode(transformMode);
        const opensInspector = key === 'm' || key === 'r' || key === 's';
        if (opensInspector && !e.shiftKey && !e.repeat && state.selectedIds.length === 1) {
          const narrow = window.matchMedia('(max-width: 900px)').matches;
          if (state.uiDensity === 'zen') state.toggleZenMode();
          if (state.aiDrawerOpen && window.matchMedia('(max-width: 1240px)').matches) {
            state.setAiDrawerOpen(false);
          }
          if (narrow) sheets.reveal('right');
          else if (state.rightCollapsed) state.toggleRightInspector();
          setPrecisionRequest({ mode: transformMode });
        }
        return;
      }

      if (key === '1') {
        state.requestCameraPreset('front');
      } else if (key === '2') {
        state.requestCameraPreset('right');
      } else if (key === '3') {
        state.requestCameraPreset('iso');
      } else if (key === '7') {
        state.requestCameraPreset('top');
      } else if (key === 'v') {
        state.setActiveTool('select');
      } else if (key === 'f') {
        state.requestCameraPreset('fit');
      } else if (key === 'h') {
        for (const id of state.selectedIds) {
          const obj = state.objects.find((o) => o.id === id);
          // H alterna Sólido / Negativo; una referencia no cambia con H (se convierte desde el menú).
          if (obj && !isReference(obj)) {
            state.updateObjectMeta(id, { role: isNegative(obj) ? 'solid' : 'negative' });
          }
        }
      } else if (key === 'm' && e.shiftKey) {
        if (state.objects.length > 0) state.setActiveDialog('mold');
      } else if (key === 'b' && !e.shiftKey) {
        state.toggleShowBed();
      } else if (key === 'x') {
        state.setSectionPlane({ enabled: !state.sectionPlane.enabled });
      } else if (key === 'p') {
        state.setActiveTool(state.activeTool === 'paint' ? 'select' : 'paint');
      } else if (key === 'd' && !e.shiftKey) {
        state.setActiveTool(state.activeTool === 'measure' ? 'select' : 'measure');
      } else if (key === 'c' && e.shiftKey) {
        if (state.selectedIds.length > 0) state.setActiveDialog('splitForBed');
      } else if (key === 'c') {
        if (state.objects.length > 0) state.setActiveDialog('cut');
      } else if (key === 'l') {
        for (const id of state.selectedIds) {
          state.dropObjectToBed(id);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.length > 0) {
          e.preventDefault();
          void confirmDeleteSelection();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheets.reveal]);

  return (
    <div className="kura-app" data-tool={activeTool} data-density={uiDensity} data-bed={showBed ? 'on' : 'off'}>
      <SkipLinks />
      <TopBar />
      <DownloadSaveNotice />
      <ProjectRecoveryBanner
        drafts={recovery.drafts}
        busy={recovery.busy}
        onRestore={recovery.restore}
        onDiscard={recovery.discard}
      />

      <div
        className="kura-workspace"
        data-narrow-panel={visibleNarrowPanel ?? undefined}
        data-sheet={visibleNarrowPanel ? sheets.height : undefined}
      >
        <NarrowPanelBar
          language={language}
          panel={visibleNarrowPanel}
          opTitle={sheets.opTitle}
          height={sheets.height}
          onToggle={sheets.toggle}
          onClose={sheets.close}
          onHeightChange={sheets.setHeight}
        />
        <LeftSidebar />
        <Viewport3D />
        <MobileTransformBar hidden={visibleNarrowPanel !== null && sheets.height === 'full'} />
        <RightInspector precisionRequest={precisionRequest} />
        {/* Destino de los paneles de operación: en escritorio ocupan el lugar del inspector. */}
        <div id="kura-op-slot" className="kura-op-slot" />
        <AiChatDrawer />
        <ProjectDropTarget />
      </div>

      <StatusBar recoveryStatus={recovery.status} recoveryFailure={recovery.failure} />
      <Dialogs />
      <ConfirmDialogHost />
      <UnitChoiceDialog />
      <RowContextMenuHost />
      <CommandPalette />
      <SplashScreen />
    </div>
  );
};

export default App;
