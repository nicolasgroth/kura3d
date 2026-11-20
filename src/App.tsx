/**
 * @file src/App.tsx
 * @description Shell principal de la aplicación Kura3D: inicialización del motor Manifold,
 * atajos de teclado CAD globales, puente MCP WebSocket, sincronización de tema y stack de toasts.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AiChatDrawer } from './components/AiChatDrawer';
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
  const initEngine = useKuraStore((s) => s.initEngine);
  const executeCommand = useKuraStore((s) => s.executeCommand);
  const setMcpConnected = useKuraStore((s) => s.setMcpConnected);
  const syncColorSchemeFromDom = useKuraStore((s) => s.syncColorSchemeFromDom);
  const toasts = useKuraStore((s) => s.toasts);
  const dismissToast = useKuraStore((s) => s.dismissToast);

  // Sincroniza título del documento e idioma del elemento <html>
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t(language, 'app.docTitle');
  }, [language]);

  // Inicializa Manifold WASM y crea el cubo inicial de calibración
  useEffect(() => {
    void initEngine();
  }, [initEngine]);

  // Conecta silenciosamente con el puente MCP local (ws://127.0.0.1:17432)
  useMcpBridgeClient(executeCommand, setMcpConnected);

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
      if (state.activeDialog !== null) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

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

      if (mod && key === 'a') {
        e.preventDefault();
        state.selectAll();
        return;
      }

      if (mod) return;

      if (key === 'g' || key === 'w') {
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
    <div className="kura-app">
      <TopBar />

      <div className="kura-workspace">
        <LeftSidebar />
        <Viewport3D />
        <RightInspector />
        <AiChatDrawer />
      </div>

      <StatusBar />
      <Dialogs />

      {/* Notificaciones Toast centradas arriba para no tapar Inspector ni Chat IA */}
      {toasts.length > 0 && (
        <div className="kura-toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`kura-toast ${toast.kind}`}>
              <span>{toast.text}</span>
              <button
                type="button"
                className="kura-mini-icon-btn"
                onClick={() => dismissToast(toast.id)}
                aria-label={t(language, 'common.close')}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
