/**
 * @file src/App.tsx
 * @description Shell principal de la aplicación Kura3D Pro v3.0: inicialización del motor Manifold,
 * densidad adaptativa (Expandido / Compacto / Zen con tecla Tab), atajos de teclado CAD globales,
 * puente MCP WebSocket, sincronización de tema y stack de toasts.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect } from 'react';
import { AiChatDrawer } from './components/AiChatDrawer';
import { CommandPalette } from './components/CommandPalette';
import { Dialogs } from './components/Dialogs';
import { LeftSidebar } from './components/LeftSidebar';
import { RightInspector } from './components/RightInspector';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { Viewport3D } from './components/Viewport3D';
import { t } from './i18n';
import { useKuraStore } from './store/useKuraStore';
import { useMcpBridgeClient } from './utils/mcpBridgeClient';

export const App: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const activeTool = useKuraStore((s) => s.activeTool);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const mcpConfig = useKuraStore((s) => s.mcpConfig);
  const initEngine = useKuraStore((s) => s.initEngine);
  const executeCommand = useKuraStore((s) => s.executeCommand);
  const setMcpConnected = useKuraStore((s) => s.setMcpConnected);
  const syncColorSchemeFromDom = useKuraStore((s) => s.syncColorSchemeFromDom);

  // Sincroniza título del documento e idioma del elemento <html>
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t(language, 'app.docTitle');
  }, [language]);

  // Inicializa Manifold WASM y crea el cubo inicial de calibración
  useEffect(() => {
    void initEngine();
  }, [initEngine]);

  // Conecta al puente MCP local únicamente cuando el usuario lo activa en Ajustes
  useMcpBridgeClient(mcpConfig, executeCommand, setMcpConnected);

  // Mantiene sincronizado el tema si el usuario lo cambia desde otra pestaña
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'kura3d-color-scheme') {
        syncColorSchemeFromDom();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [syncColorSchemeFromDom]);

  // Atajos de teclado globales del estudio CAD
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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

      const state = useKuraStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'k') {
        e.preventDefault();
        if (state.activeDialog === null) {
          state.setCommandPaletteOpen(!state.commandPaletteOpen);
        }
        return;
      }

      if (mod && e.key === ',') {
        e.preventDefault();
        state.openSettings('ai');
        return;
      }

      if (state.activeDialog !== null || state.commandPaletteOpen) {
        return;
      }

      // Tecla Tab alterna Modo Zen (100% viewport) sin capturar foco de inputs
      if (e.key === 'Tab' && !mod && !e.altKey) {
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

      if (mod && key === 'g') {
        e.preventDefault();
        const primaryId = state.selectedIds[0] ?? state.objects[0]?.id;
        if (e.shiftKey) {
          if (primaryId) void state.splitDisconnectedObject(primaryId);
        } else {
          const selectedObjs = state.objects.filter((o) => state.selectedIds.includes(o.id));
          const selHasHole = selectedObjs.some((o) => o.isHole && o.visible);
          const selHasSolid = selectedObjs.some((o) => !o.isHole && o.visible);
          const sceneHasHole = state.objects.some((o) => o.isHole && o.visible);
          const sceneHasSolid = state.objects.some((o) => !o.isHole && o.visible);
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

      if (key === '1') {
        state.requestCameraPreset('front');
      } else if (key === '2') {
        state.requestCameraPreset('right');
      } else if (key === '3') {
        state.requestCameraPreset('iso');
      } else if (key === '7') {
        state.requestCameraPreset('top');
      } else if (key === 'g' || key === 'w') {
        state.setActiveTool('select');
        state.setTransformMode('translate');
      } else if (key === 'r') {
        state.setActiveTool('select');
        state.setTransformMode('rotate');
      } else if (key === 's') {
        state.setActiveTool('select');
        state.setTransformMode('scale');
      } else if (key === 'v') {
        state.setActiveTool('select');
      } else if (key === 'f') {
        state.requestCameraPreset('fit');
      } else if (key === 'h') {
        for (const id of state.selectedIds) {
          const obj = state.objects.find((o) => o.id === id);
          if (obj) {
            state.updateObjectMeta(id, { isHole: !obj.isHole });
          }
        }
      } else if (key === 'm') {
        if (e.shiftKey) {
          if (state.objects.length > 0) state.setActiveDialog('mold');
        } else {
          const mirrorIds =
            state.selectedIds.length > 0
              ? state.selectedIds
              : state.objects.length === 1
                ? [state.objects[0].id]
                : [];
          for (const id of mirrorIds) {
            state.mirrorObject(id, 'x');
          }
        }
      } else if (key === 'x') {
        state.setSectionPlane({ enabled: !state.sectionPlane.enabled });
      } else if (key === 'p') {
        state.setActiveTool(state.activeTool === 'paint' ? 'select' : 'paint');
      } else if (key === 'c') {
        if (state.objects.length > 0) state.setActiveDialog('cut');
      } else if (key === 'l') {
        for (const id of state.selectedIds) {
          state.dropObjectToBed(id);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.length > 0) {
          e.preventDefault();
          state.deleteObjects();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="kura-app" data-tool={activeTool} data-density={uiDensity}>
      <TopBar />

      <div className="kura-workspace">
        <LeftSidebar />
        <Viewport3D />
        <RightInspector />
        <AiChatDrawer />
      </div>

      <StatusBar />
      <Dialogs />
      <CommandPalette />
    </div>
  );
};

export default App;
