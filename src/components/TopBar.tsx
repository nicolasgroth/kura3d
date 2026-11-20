/**
 * @file src/components/TopBar.tsx
 * @description Barra superior principal de Kura3D: marca geométrica, importación/exportación rápida,
 * Undo/Redo, selector de herramientas, perfil de impresora, unidades, paleta Ctrl+K, estado MCP
 * configurable/seguro, indicador explícito IA Externa vs Local y tema visual.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useState } from 'react';
import {
  Bot,
  Cloud,
  Download,
  Eraser,
  FileUp,
  Lock,
  Moon,
  MousePointer,
  Paintbrush,
  Redo2,
  Scissors,
  Search,
  Settings,
  Sun,
  Undo2,
  Zap,
} from 'lucide-react';
import { getLocalizedPrinterName, t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import {
  DEFAULT_PRINTER_PROFILES,
  type ActiveTool,
  type UnitSystem,
} from '../types/kura';
import { getAiBadgeDescriptor } from '../utils/aiBadges';

const UNIT_OPTIONS: UnitSystem[] = ['mm', 'cm', 'm', 'in', 'ft'];

/** Detecta si el sistema operativo prefiere modo oscuro en tiempo real. */
function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return prefersDark;
}

export const TopBar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const setLanguage = useKuraStore((s) => s.setLanguage);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const setUnitSystem = useKuraStore((s) => s.setUnitSystem);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const setColorScheme = useKuraStore((s) => s.setColorScheme);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const setPrinterProfile = useKuraStore((s) => s.setPrinterProfile);
  const activeTool = useKuraStore((s) => s.activeTool);
  const setActiveTool = useKuraStore((s) => s.setActiveTool);
  const pastCount = useKuraStore((s) => s.past.length);
  const futureCount = useKuraStore((s) => s.future.length);
  const undo = useKuraStore((s) => s.undo);
  const redo = useKuraStore((s) => s.redo);
  const importMeshFromDialog = useKuraStore((s) => s.importMeshFromDialog);
  const exportSceneStl = useKuraStore((s) => s.exportSceneStl);
  const exportScene3mf = useKuraStore((s) => s.exportScene3mf);
  const openSettings = useKuraStore((s) => s.openSettings);
  const setCommandPaletteOpen = useKuraStore((s) => s.setCommandPaletteOpen);
  const mcpConnected = useKuraStore((s) => s.mcpConnected);
  const mcpConfig = useKuraStore((s) => s.mcpConfig);
  const aiConfig = useKuraStore((s) => s.aiConfig);
  const aiDrawerOpen = useKuraStore((s) => s.aiDrawerOpen);
  const setAiDrawerOpen = useKuraStore((s) => s.setAiDrawerOpen);

  const systemDark = useSystemPrefersDark();
  const isRenderedDark =
    colorScheme === 'dark' || (colorScheme === 'system' && systemDark);

  const aiBadge = getAiBadgeDescriptor(aiConfig, language);

  /**
   * Toggle inteligente de 2 estados en barra superior:
   * alterna al opuesto del tema visible actual y libera el override a `'system'`
   * cuando coincide con la preferencia del sistema operativo.
   */
  const handleToggleTheme = () => {
    const targetScheme = isRenderedDark ? 'light' : 'dark';
    const systemScheme = systemDark ? 'dark' : 'light';
    if (targetScheme === systemScheme) {
      setColorScheme('system');
    } else {
      setColorScheme(targetScheme);
    }
  };

  const tools: Array<{
    id: ActiveTool;
    icon: React.ReactNode;
    labelKey: 'select' | 'paint' | 'cut' | 'erase';
  }> = [
    { id: 'select', icon: <MousePointer size={13} />, labelKey: 'select' },
    { id: 'paint', icon: <Paintbrush size={13} />, labelKey: 'paint' },
    { id: 'cut', icon: <Scissors size={13} />, labelKey: 'cut' },
    { id: 'erase', icon: <Eraser size={13} />, labelKey: 'erase' },
  ];

  const mcpLabel = !mcpConfig.enabled
    ? t(language, 'topbar.mcpOff')
    : mcpConnected
      ? t(language, 'topbar.mcpConnected')
      : t(language, 'topbar.mcpLocal');

  const mcpTooltip = !mcpConfig.enabled
    ? t(language, 'topbar.mcpDisabledTip')
    : `${mcpLabel} (127.0.0.1:${mcpConfig.port})${
        mcpConfig.requireAuth ? ` · ${t(language, 'topbar.mcpAuthTip')}` : ''
      }`;

  return (
    <header className="kura-topbar">
      {/* Marca Kura3D + Archivo rápido + Undo/Redo */}
      <div className="kura-topbar-group kura-topbar-left">
        <div className="kura-brand" title={t(language, 'app.tagline')}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <polygon
              points="12,2 21,7 21,17 12,22 3,17 3,7"
              stroke="var(--tool-accent)"
              strokeWidth="2"
              fill="color-mix(in srgb, var(--tool-accent) 18%, transparent)"
            />
            <polyline
              points="3,7 12,12 21,7"
              stroke="var(--tool-accent)"
              strokeWidth="1.8"
            />
            <line
              x1="12"
              y1="12"
              x2="12"
              y2="22"
              stroke="var(--accent-amber)"
              strokeWidth="2"
            />
          </svg>
          <span className="kura-brand-title">Kura3D</span>
        </div>

        <button
          type="button"
          className="kura-btn kura-btn-sm"
          onClick={() => void importMeshFromDialog()}
          title={t(language, 'topbar.importModelTip')}
        >
          <FileUp size={13} />
          <span>{t(language, 'topbar.importShort')}</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          disabled={pastCount === 0}
          onClick={undo}
          title={t(language, 'topbar.undoTip')}
          aria-label={t(language, 'topbar.undo')}
        >
          <Undo2 size={13} />
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          disabled={futureCount === 0}
          onClick={redo}
          title={t(language, 'topbar.redoTip')}
          aria-label={t(language, 'topbar.redo')}
        >
          <Redo2 size={13} />
        </button>
      </div>

      {/* Herramientas principales del estudio */}
      <div className="kura-topbar-group kura-topbar-center">
        <div className="kura-segmented" role="group" aria-label="Herramientas">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`kura-btn ${activeTool === tool.id ? 'is-active' : ''}`}
              onClick={() => setActiveTool(tool.id)}
              title={t(language, `topbar.tool.${tool.labelKey}Tip`)}
            >
              {tool.icon}
              <span className="kura-tool-label">
                {t(language, `topbar.tool.${tool.labelKey}`)}
              </span>
            </button>
          ))}
        </div>

        <select
          className="kura-select kura-printer-select"
          value={printerProfile.id}
          onChange={(e) => setPrinterProfile(e.target.value)}
          aria-label={t(language, 'topbar.printerProfile')}
          title={t(language, 'topbar.printerProfile')}
        >
          {DEFAULT_PRINTER_PROFILES.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {getLocalizedPrinterName(language, profile)}
            </option>
          ))}
        </select>

        <select
          className="kura-select kura-unit-select"
          value={unitSystem}
          onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}
          aria-label={t(language, 'topbar.unitLabel')}
          title={t(language, 'topbar.unitLabel')}
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary"
          onClick={() => void exportSceneStl(false)}
          title={t(language, 'topbar.exportStlTip')}
        >
          <Download size={13} />
          <span>STL</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-amber"
          onClick={() => void exportScene3mf(false)}
          title={t(language, 'topbar.export3mfTip')}
        >
          <Download size={13} />
          <span>3MF</span>
        </button>
      </div>

      {/* Grupo de utilidades fijado a la derecha */}
      <div className="kura-topbar-group kura-topbar-right">
        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          onClick={() => setCommandPaletteOpen(true)}
          title={t(language, 'topbar.cmdPaletteTip')}
          aria-label={t(language, 'topbar.cmdPalette')}
        >
          <Search size={13} />
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-sm"
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          title={t(language, 'topbar.languageToggle')}
        >
          {language.toUpperCase()}
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          onClick={handleToggleTheme}
          title={
            isRenderedDark
              ? t(language, 'topbar.theme.switchToLight')
              : t(language, 'topbar.theme.switchToDark')
          }
          aria-label={
            isRenderedDark
              ? t(language, 'topbar.theme.switchToLight')
              : t(language, 'topbar.theme.switchToDark')
          }
        >
          {isRenderedDark ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <button
          type="button"
          className={`kura-pill ${
            !mcpConfig.enabled ? 'is-off' : mcpConnected ? 'is-online' : ''
          }`}
          onClick={() => openSettings('mcp')}
          title={mcpTooltip}
          aria-label={mcpTooltip}
        >
          <span className="kura-dot" />
          <span className="kura-mcp-label">{mcpLabel}</span>
          {mcpConfig.enabled && mcpConfig.requireAuth && (
            <Lock size={10} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className={`kura-btn kura-btn-sm kura-ai-toggle-btn tone-${aiBadge.cssTone} ${
            aiDrawerOpen ? 'is-active' : ''
          }`}
          onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
          title={`${t(language, 'topbar.aiChatTip')} — ${aiBadge.label}: ${aiBadge.tooltip}`}
        >
          {aiBadge.mode === 'external' ? (
            <Cloud size={13} />
          ) : aiBadge.mode === 'ollama' ? (
            <Bot size={13} />
          ) : (
            <Zap size={13} />
          )}
          <span>{language === 'es' ? 'IA' : 'AI'}</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          onClick={() => openSettings('ai')}
          title={t(language, 'topbar.settingsTip')}
          aria-label={t(language, 'topbar.settings')}
        >
          <Settings size={13} />
        </button>
      </div>
    </header>
  );
};
