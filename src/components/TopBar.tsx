/**
 * @file src/components/TopBar.tsx
 * @description Barra superior principal de Kura3D v0.5.0: marca oficial con ícono y versión,
 * importación/exportación Multi-Slicer (STL/3MF), Undo/Redo, selector de herramientas, perfil de
 * selector compacto de 6 idiomas, acceso directo a temas WCAG,
 * toggle de densidad adaptativa (Expandido / Compacto / Zen), paleta Ctrl+K, estado MCP seguro
 * y acceso al Asistente IA.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import {
  SUPPORTED_LANGUAGES,
  type ActiveTool,
  type LanguageCode,
} from '../types/kura';
import { getAiBadgeDescriptor } from '../utils/aiBadges';
import { useMcpBridgeStatus } from '../utils/mcpBridgeClient';
import { describeMcpBridge } from '../utils/mcpBridgeHealth';
import { openExportDialog } from './ExportDialog';
import { ImportMenuButton } from './ImportMenuButton';
import { ProjectMenu } from './ProjectMenu';
import { TopBarOverflowMenu } from './TopBarOverflowMenu';
import { naturalRowWidth, pickTopbarLevel, recordTopbarWidth } from './topbarFit';
import '../styles/topbarOverflow.css';
import '../styles/statusFit.css';


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

/**
 * Controles opcionales, del primero al último en pasar al menú "Más".
 * Proyecto, Importar, Exportar, Deshacer/Rehacer y Ajustes nunca se ocultan.
 */
const HIDE_ORDER = [
  'density',
  'palette',
  'lang',
  'themes',
  'theme',
  'mcp',
  'ai',
  'tools',
  'brand',
] as const;
type HideId = (typeof HIDE_ORDER)[number];

/** Observa la barra y cada control de sus grupos (los controles cambian al subir o bajar de nivel). */
function observeTopbar(el: HTMLElement | null, observer: ResizeObserver | null): void {
  if (!el || !observer) return;
  observer.disconnect();
  observer.observe(el);
  for (const group of Array.from(el.children)) {
    for (const item of Array.from(group.children)) observer.observe(item);
  }
}

export const TopBar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const setLanguage = useKuraStore((s) => s.setLanguage);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const setColorScheme = useKuraStore((s) => s.setColorScheme);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const cycleUiDensity = useKuraStore((s) => s.cycleUiDensity);
  const activeTool = useKuraStore((s) => s.activeTool);
  const setActiveTool = useKuraStore((s) => s.setActiveTool);
  const pastCount = useKuraStore((s) => s.past.length);
  const futureCount = useKuraStore((s) => s.future.length);
  /** Tooltip de deshacer/rehacer con los pasos disponibles ("Deshacer (Ctrl+Z) · 37 pasos"). */
  const stepTip = (base: 'topbar.undoTip' | 'topbar.redoTip', counted: 'topbar.undoTipCount' | 'topbar.redoTipCount', count: number) =>
    count === 0
      ? t(language, base)
      : count === 1
        ? t(language, `${counted}.one`)
        : t(language, counted, { count });
  const undo = useKuraStore((s) => s.undo);
  const redo = useKuraStore((s) => s.redo);
  const openSettings = useKuraStore((s) => s.openSettings);
  const setCommandPaletteOpen = useKuraStore((s) => s.setCommandPaletteOpen);
  const bridgeStatus = useMcpBridgeStatus();
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

  // Nivel de ahorro de espacio: 0 = completo, 1 = etiquetas compactas, 2+ = oculta controles en orden.
  const headerRef = useRef<HTMLElement>(null);
  const [level, setLevel] = useState(0);
  const maxLevel = HIDE_ORDER.length + 1;
  const hidden = new Set<HideId>(level >= 2 ? HIDE_ORDER.slice(0, level - 1) : []);
  const isHidden = (id: HideId) => hidden.has(id);

  // Anchos naturales medidos por nivel; se invalidan cuando el contenido cambia.
  const levelRef = useRef(level);
  levelRef.current = level;
  const widthsRef = useRef<Array<number | undefined>>([]);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Mide el nivel actual y elige el que cabe (sube o baja). Se llama tras cada render y en cada
  // cambio de tamaño de la barra o de sus controles (título, idioma, chat, carga de proyecto).
  const refit = React.useCallback(() => {
    const el = headerRef.current;
    if (!el) return;
    const current = levelRef.current;
    widthsRef.current = recordTopbarWidth(widthsRef.current, current, naturalRowWidth(el));
    const next = pickTopbarLevel(el.clientWidth, widthsRef.current, maxLevel);
    if (next !== current) setLevel(next);
  }, [maxLevel]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => refit());
    observerRef.current = observer;
    observeTopbar(headerRef.current, observer);
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [refit]);

  // Cambios que alteran anchos de otros niveles: se descartan las mediciones guardadas.
  useLayoutEffect(() => {
    widthsRef.current = [];
  }, [language, uiDensity, bridgeStatus.phase, mcpConfig.enabled, mcpConfig.requireAuth, aiDrawerOpen, aiConfig]);

  // Tras cada render: vuelve a observar la barra y sus controles, y reajusta antes de pintar.
  useLayoutEffect(() => {
    observeTopbar(headerRef.current, observerRef.current);
    refit();
  });

  const mcpView = describeMcpBridge(language, mcpConfig.enabled, bridgeStatus);
  const mcpLabel = mcpView.short;

  const mcpTooltip = !mcpConfig.enabled
    ? t(language, 'topbar.mcpDisabledTip')
    : `${mcpView.label} (127.0.0.1:${mcpConfig.port})${
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

  const brandEl = (
    <div className="kura-brand" title={t(language, 'app.tagline')}>
      <img
        src="/branding/kura3d-icon.png"
        alt="Kura3D"
        className="kura-brand-icon-img"
        width={26}
        height={26}
      />
      {!isHidden('brand') && (
        <>
          <span className="kura-brand-title">Kura3D</span>
          <span className="kura-brand-badge">0.5</span>
        </>
      )}
    </div>
  );

  const toolButton = (tool: (typeof tools)[number], inMenu: boolean) => (
    <button
      key={tool.id}
      type="button"
      role={inMenu ? 'menuitemradio' : undefined}
      aria-checked={inMenu ? activeTool === tool.id : undefined}
      aria-pressed={inMenu ? undefined : activeTool === tool.id}
      className={`kura-btn ${activeTool === tool.id ? 'is-active' : ''}`}
      onClick={() => setActiveTool(tool.id)}
      title={t(language, `topbar.tool.${tool.labelKey}Tip`)}
      aria-label={t(language, `topbar.tool.${tool.labelKey}`)}
    >
      {tool.icon}
      <span className="kura-tool-label">{t(language, `topbar.tool.${tool.labelKey}`)}</span>
    </button>
  );

  const langSelect = (
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
  );

  const themeTip = isRenderedDark
    ? t(language, 'topbar.theme.switchToLight')
    : t(language, 'topbar.theme.switchToDark');
  const aiIcon =
    aiBadge.mode === 'external' ? (
      <Cloud size={13} />
    ) : aiBadge.mode === 'ollama' ? (
      <Bot size={13} />
    ) : (
      <Zap size={13} />
    );
  const aiShort = t(language, 'topbar.aiShort');
  const aiTip = `${t(language, 'topbar.aiChatTip')} — ${aiBadge.label}: ${aiBadge.tooltip}`;
  const showMore = hidden.size > 0;

  return (
    <header
      ref={headerRef}
      className={`kura-topbar kura-topbar-adaptive ${level >= 1 ? 'is-compact' : ''} ${level >= 9 ? 'is-narrow' : ''}`}
    >
      {/* Marca oficial Kura3D v0.5.0 + Archivo rápido + Undo/Redo */}
      <div className="kura-topbar-group kura-topbar-left">
        {brandEl}

        <ImportMenuButton />

        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          disabled={pastCount === 0}
          onClick={undo}
          title={stepTip('topbar.undoTip', 'topbar.undoTipCount', pastCount)}
          aria-label={t(language, 'topbar.undo')}
        >
          <Undo2 size={13} />
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          disabled={futureCount === 0}
          onClick={redo}
          title={stepTip('topbar.redoTip', 'topbar.redoTipCount', futureCount)}
          aria-label={t(language, 'topbar.redo')}
        >
          <Redo2 size={13} />
        </button>
        <ProjectMenu />
      </div>

      {/* Herramientas principales del estudio */}
      <div className="kura-topbar-group kura-topbar-center">
        {!isHidden('tools') && (
          <div className="kura-segmented" role="group" aria-label={t(language, 'topbar.toolsGroup')}>
            {tools.map((tool) => toolButton(tool, false))}
          </div>
        )}

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
        {!isHidden('density') && (
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
        )}

        {!isHidden('palette') && (
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            onClick={() => setCommandPaletteOpen(true)}
            title={t(language, 'topbar.cmdPaletteTip')}
            aria-label={t(language, 'topbar.cmdPalette')}
          >
            <Search size={13} />
          </button>
        )}

        {!isHidden('lang') && (
          <div
            className="kura-lang-select-wrap"
            title={`${t(language, 'topbar.languageSelect')}: ${currentLangSpec.nativeName}`}
          >
            <span className="kura-lang-select-face" aria-hidden="true">
              <span>{currentLangSpec.shortLabel}</span>
              <ChevronDown size={11} />
            </span>
            {langSelect}
          </div>
        )}

        {!isHidden('themes') && (
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            onClick={() => openSettings('appearance')}
            title={t(language, 'topbar.themesShortcut')}
            aria-label={t(language, 'topbar.themesShortcut')}
          >
            <Palette size={13} />
          </button>
        )}

        {!isHidden('theme') && (
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            onClick={handleToggleTheme}
            title={themeTip}
            aria-label={themeTip}
          >
            {isRenderedDark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        )}

        {!isHidden('mcp') && (
          <button
            type="button"
            className={`kura-pill is-${mcpView.tone}`}
            onClick={() => openSettings('mcp')}
            title={mcpTooltip}
            aria-label={mcpTooltip}
          >
            <span className="kura-dot" />
            <span className="kura-mcp-label">{mcpLabel}</span>
            {mcpConfig.enabled && mcpConfig.requireAuth && <Lock size={10} aria-hidden="true" />}
          </button>
        )}

        {!isHidden('ai') && (
          <button
            type="button"
            className={`kura-btn kura-btn-sm kura-ai-toggle-btn tone-${aiBadge.cssTone} ${
              aiDrawerOpen ? 'is-active' : ''
            }`}
            onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
            title={aiTip}
            aria-label={t(language, 'topbar.aiChat')}
            aria-pressed={aiDrawerOpen}
          >
            {aiIcon}
            <span className="kura-btn-label">{aiShort}</span>
          </button>
        )}

        {showMore && (
          <TopBarOverflowMenu
            label={t(language, 'topbar.more')}
            tooltip={t(language, 'topbar.moreTip')}
          >
            {isHidden('tools') &&
              tools.map((tool) => <React.Fragment key={tool.id}>{toolButton(tool, true)}</React.Fragment>)}
            {isHidden('lang') && (
              <label className="kura-topbar-more-row">
                {t(language, 'topbar.languageSelect')}
                {langSelect}
              </label>
            )}
            {isHidden('density') && (
              <button
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm"
                onClick={cycleUiDensity}
                title={t(language, 'ui.density.cycleTip')}
              >
                {densityIcon}
                <span>{`${t(language, 'ui.density.cycleTip')} (${densityLabel})`}</span>
              </button>
            )}
            {isHidden('palette') && (
              <button
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm"
                onClick={() => setCommandPaletteOpen(true)}
                title={t(language, 'topbar.cmdPaletteTip')}
              >
                <Search size={13} />
                <span>{t(language, 'topbar.cmdPalette')}</span>
              </button>
            )}
            {isHidden('themes') && (
              <button
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm"
                onClick={() => openSettings('appearance')}
                title={t(language, 'topbar.themesShortcut')}
              >
                <Palette size={13} />
                <span>{t(language, 'topbar.themesShortcut')}</span>
              </button>
            )}
            {isHidden('theme') && (
              <button
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm"
                onClick={handleToggleTheme}
                title={themeTip}
              >
                {isRenderedDark ? <Sun size={13} /> : <Moon size={13} />}
                <span>{themeTip}</span>
              </button>
            )}
            {isHidden('mcp') && (
              <button
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm"
                onClick={() => openSettings('mcp')}
                title={mcpTooltip}
              >
                <span className="kura-dot" aria-hidden="true" />
                <span>{mcpLabel}</span>
                {mcpConfig.enabled && mcpConfig.requireAuth && <Lock size={10} aria-hidden="true" />}
              </button>
            )}
            {isHidden('ai') && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={aiDrawerOpen}
                className={`kura-btn kura-btn-sm ${aiDrawerOpen ? 'is-active' : ''}`}
                onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
                title={aiTip}
              >
                {aiIcon}
                <span>{t(language, 'topbar.aiChat')}</span>
              </button>
            )}
          </TopBarOverflowMenu>
        )}

        <button
          type="button"
          className="kura-btn kura-btn-icon kura-btn-sm"
          onClick={() => openSettings('appearance')}
          title={t(language, 'topbar.settingsTip')}
          aria-label={t(language, 'topbar.settings')}
        >
          <Settings size={13} />
        </button>
      </div>
    </header>
  );
};
