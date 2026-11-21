/**
 * @file src/components/TopBar.tsx
 * @description Barra superior principal de Kura3D v0.5.0: marca oficial con ícono y versión,
 * importación/exportación Multi-Slicer (STL/3MF), Undo/Redo, selector de herramientas, perfil de
 * impresora multi-marca, unidades, selector compacto de 6 idiomas, acceso directo a temas WCAG,
 * toggle de densidad adaptativa (Expandido / Compacto / Zen), paleta Ctrl+K, estado MCP seguro
 * y acceso al Asistente IA.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Cloud,
  Columns2,
  Download,
  Eraser,
  LayoutGrid,
  Lock,
  Maximize2,
  Moon,
  MousePointer,
  Paintbrush,
  Palette,
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
  SUPPORTED_LANGUAGES,
  type ActiveTool,
  type LanguageCode,
  type UnitSystem,
} from '../types/kura';
import { getAiBadgeDescriptor } from '../utils/aiBadges';
import { openExportDialog } from './ExportDialog';
import { ImportMenuButton } from './ImportMenuButton';
import { ProjectMenu } from './ProjectMenu';

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
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const cycleUiDensity = useKuraStore((s) => s.cycleUiDensity);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const setPrinterProfile = useKuraStore((s) => s.setPrinterProfile);
  const activeTool = useKuraStore((s) => s.activeTool);
  const setActiveTool = useKuraStore((s) => s.setActiveTool);
  const pastCount = useKuraStore((s) => s.past.length);
  const futureCount = useKuraStore((s) => s.future.length);
  const undo = useKuraStore((s) => s.undo);
  const redo = useKuraStore((s) => s.redo);
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
  const currentLangSpec =
    SUPPORTED_LANGUAGES.find((spec) => spec.code === language) ?? SUPPORTED_LANGUAGES[0];

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

  const densityIcon =
    uiDensity === 'full' ? (
      <LayoutGrid size={13} />
    ) : uiDensity === 'compact' ? (
      <Columns2 size={13} />
    ) : (
      <Maximize2 size={13} />
    );

  const densityLabel = t(language, `ui.density.${uiDensity}`);

  return (
    <header className="kura-topbar">
      {/* Marca oficial Kura3D v0.5.0 + Archivo rápido + Undo/Redo */}
      <div className="kura-topbar-group kura-topbar-left">
        <div className="kura-brand" title={t(language, 'app.tagline')}>
          <img
            src="/branding/kura3d-icon.png"
            alt="Kura3D"
            className="kura-brand-icon-img"
            width={26}
            height={26}
          />
          <span className="kura-brand-title">Kura3D</span>
          <span className="kura-brand-badge">0.5</span>
        </div>

        <ImportMenuButton />

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
        <ProjectMenu />
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
              aria-label={t(language, `topbar.tool.${tool.labelKey}`)}
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
          title={getLocalizedPrinterName(language, printerProfile)}
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
          onClick={() => openExportDialog()}
          title={t(language, 'topbar.exportTip')}
          aria-label={t(language, 'topbar.export')}
        >
          <Download size={13} aria-hidden="true" />
          <span className="kura-btn-label">{t(language, 'topbar.export')}</span>
        </button>
      </div>

      {/* Grupo de utilidades fijado a la derecha */}
      <div className="kura-topbar-group kura-topbar-right">
        <button
          type="button"
          className={`kura-btn kura-btn-sm ${uiDensity !== 'full' ? 'is-active' : ''}`}
          onClick={cycleUiDensity}
          title={`${t(language, 'ui.density.cycleTip')} (${densityLabel})`}
          aria-label={t(language, 'ui.density.cycleTip')}
        >
          {densityIcon}
          <span className="kura-btn-label">{densityLabel}</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          onClick={() => setCommandPaletteOpen(true)}
          title={t(language, 'topbar.cmdPaletteTip')}
          aria-label={t(language, 'topbar.cmdPalette')}
        >
          <Search size={13} />
        </button>

        <div
          className="kura-lang-select-wrap"
          title={`${t(language, 'topbar.languageSelect')}: ${currentLangSpec.nativeName}`}
        >
          <span className="kura-lang-select-face" aria-hidden="true">
            <span>{currentLangSpec.shortLabel}</span>
            <ChevronDown size={11} />
          </span>
          <select
            className="kura-lang-select-native"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            aria-label={t(language, 'topbar.languageSelect')}
          >
            {SUPPORTED_LANGUAGES.map((spec) => (
              <option key={spec.code} value={spec.code}>
                {spec.shortLabel} — {spec.nativeName}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          onClick={() => openSettings('appearance')}
          title={t(language, 'topbar.themesShortcut')}
          aria-label={t(language, 'topbar.themesShortcut')}
        >
          <Palette size={13} />
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
          aria-label={t(language, 'topbar.aiChat')}
        >
          {aiBadge.mode === 'external' ? (
            <Cloud size={13} />
          ) : aiBadge.mode === 'ollama' ? (
            <Bot size={13} />
          ) : (
            <Zap size={13} />
          )}
          <span className="kura-btn-label">
            {language === 'es' || language === 'fr' ? 'IA' : 'AI'}
          </span>
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
