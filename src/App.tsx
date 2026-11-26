/**
 * @file src/App.tsx
 * @description Shell principal de la aplicación Kurra Studio v0.5.0: inicialización del motor Manifold,
 * pantalla de bienvenida animada (SplashScreen), densidad adaptativa (Expandido / Compacto / Zen
 * con Ctrl/⌘+Shift+Enter), atajos de teclado CAD globales, puente MCP WebSocket, sincronización de tema y
 * esquema de color, y stack de notificaciones toast.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AiChatDrawer } from './components/AiChatDrawer';
import { CommandPalette } from './components/CommandPalette';
import { Dialogs } from './components/Dialogs';
import { AboutLayer } from './components/about/AboutDialog';
import { LeftSidebar } from './components/LeftSidebar';
import { ProjectDropTarget } from './components/ProjectDropTarget';
import { ProjectRecoveryBanner } from './components/ProjectRecoveryBanner';
import { DownloadSaveNotice } from './components/DownloadSaveNotice';
import { RightInspector } from './components/RightInspector';
import { requestLeftPanelTab } from './components/leftPanelTabRequest';
import { SplashScreen } from './components/SplashScreen';
import { StatusBar } from './components/StatusBar';
import { PlateStrip } from './components/plates/PlateStrip';
import { SkipLinks } from './components/SkipLinks';
import { TopBar } from './components/TopBar';
import { Viewport3D } from './components/Viewport3D';
import { t } from './i18n';
import { useProjectRecovery } from './project/useProjectRecovery';
import { useWorkTimer } from './utils/workTimer';
import { isProjectDirty, useKuraStore } from './store/useKuraStore';
import type { TransformMode } from './types/kura';
import { useMcpBridgeClient } from './utils/mcpBridgeClient';
import { isTauriRuntime } from './utils/platformBridge';
import { useFunctionKeys } from './components/useFunctionKeys';
import { LOG_TAG } from './brand';
import { ConfirmDialogHost } from './components/ConfirmDialogHost';
import { UnitChoiceDialog } from './components/dialogs/UnitChoiceDialog';
import { FitToBedDialog } from './components/fitToBed/FitToBedDialog';
import { RowContextMenuHost } from './components/scene/RowContextMenuHost';
import { NarrowPanelBar } from './components/NarrowPanelBar';
import { useNarrowSheets } from './components/narrow/useNarrowSheets';
import { MobileTransformBar } from './components/narrow/MobileTransformBar';
import { OPEN_INSPECTOR_EVENT } from './components/inspector/hollowPanelRequest';
import { ToolRail } from './components/shell/ToolRail';
import { Text3DPanel } from './components/text3d/Text3DPanel';
import { AssistantsPanel } from './components/assistants/AssistantsPanel';
import { MagnetPanel } from './components/magnet/MagnetPanel';
import { ScrewBossPanel } from './components/screwBoss/ScrewBossPanel';
import { PlateArrangePanel } from './components/plates/PlateArrangePanel';
import { PatternPanel } from './components/pattern/PatternPanel';
import { KeyholePanel } from './components/keyhole/KeyholePanel';
import { CablePassPanel } from './components/cablePass/CablePassPanel';
import { resolveShortcut } from './store/keyboardShortcuts';
import { dispatchShortcut, readShortcutContext } from './components/shell/dispatchShortcut';
import { startPanelExclusion } from './store/insertCatalog';
import { startMinWidthNotice } from './store/minWidthNotice';
import { HelpTooltipLayer } from './components/shell/HelpTooltipLayer';
import { useSimplifyRequestRelay } from './components/inspector/simplifyPanelRequest';

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
  // Tiempo de trabajo del proyecto (solo local, se guarda en el .kura): ver `utils/workTimer.ts`.
  useWorkTimer();
  // Texto 3D y Asistentes comparten hueco: el arranque explícito de su exclusión mutua (una sola vez).
  useEffect(() => startPanelExclusion(), []);
  // La app está pensada para 1024 px o más: bajo ese ancho se avisa una vez, sin bloquear.
  useEffect(() => startMinWidthNotice(), []);
  const discardRecoveryOnClose = recovery.discardOnClose;

  // F2/F3 necesitan la lista de escena: en pantallas estrechas el panel izquierdo es un cajón, y se pide la
  // pestaña Escena para que el botón Formas / Escena de la barra inferior marque la que se ve.
  const revealLeftPanel = useCallback(() => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      sheets.reveal('left');
      requestLeftPanelTab('scene');
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
    // Las reglas viven en `store/keyboardShortcuts` (tabla probada); aquí solo se resuelve y se despacha.
    const ui = {
      revealRightSheet: () => sheets.reveal('right'),
      requestPrecision: (mode: TransformMode) => setPrecisionRequest({ mode }),
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const { action, preventDefault } = resolveShortcut(e, readShortcutContext(e.target));
      if (preventDefault) e.preventDefault();
      if (!action) return;
      if (dispatchShortcut(action, e, ui)) e.preventDefault();
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
        {/* Antes de la barra lateral en el orden de tabulación (barra superior → herramientas → vista → visor →
            paneles); el CSS la dibuja entre la barra lateral y el visor. */}
        <ToolRail />
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
        <Text3DPanel />
        <AssistantsPanel />
        <MagnetPanel />
        <ScrewBossPanel />
        <PlateArrangePanel />
        <PatternPanel />
        <KeyholePanel />
        <CablePassPanel />
        <AiChatDrawer />
        <ProjectDropTarget />
      </div>

      <PlateStrip />
      <StatusBar recoveryStatus={recovery.status} recoveryFailure={recovery.failure} />
      <Dialogs />
      <AboutLayer />
      <ConfirmDialogHost />
      <UnitChoiceDialog />
      <FitToBedDialog />
      <RowContextMenuHost />
      <CommandPalette />
      <HelpTooltipLayer />
      <SplashScreen />
    </div>
  );
};

export default App;
