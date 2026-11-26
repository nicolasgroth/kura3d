/**
 * @file src/components/TopBar.tsx
 * @description Barra superior de aplicación (una fila): a la izquierda marca y versión, grupo Archivo
 * (Importar, Proyecto, Exportar: Importar y Exportar con texto siempre; Proyecto muestra el panel derecho
 * «Proyecto», sin menú), Edición (Deshacer, Rehacer e historial) y los menús Insertar y Acciones; a la derecha
 * paleta, idioma (bandera y código), temas, tema claro/oscuro, rótulos, MCP (siempre con el texto «MCP»), IA y
 * Ajustes. Si falta ancho, pasa al menú «Más» lo menos usado y después quita rótulos. Las herramientas viven en la barra
 * vertical junto al visor; en pantallas estrechas (sin barra vertical) siguen en el menú «Más».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Bot,
  CaseSensitive,
  Cloud,
  Download,
  Eraser,
  Lock,
  Moon,
  MousePointer,
  Paintbrush,
  Palette,
  Redo2,
  Ruler,
  Scissors,
  Search,
  Info,
  Settings,
  Sun,
  Undo2,
  Zap,
} from 'lucide-react';
import { t } from '../i18n';
import { BRAND } from '../brand';
import { useKuraStore } from '../store/useKuraStore';
import type { ActiveTool } from '../types/kura';
import { getAiBadgeDescriptor } from '../utils/aiBadges';
import { useMcpBridgeStatus } from '../utils/mcpBridgeClient';
import { handleLogoClick } from '../utils/logoEasterEgg';
import { describeMcpBridge } from '../utils/mcpBridgeHealth';
import { openExportDialog } from './ExportDialog';
import { ImportMenuButton } from './ImportMenuButton';
import { LanguageMenu, LanguageRadioItems } from './LanguageMenu';
import { ProjectButton } from './ProjectButton';
import { TopBarOverflowMenu } from './TopBarOverflowMenu';
import { naturalRowWidth, pickTopbarLevel, recordTopbarWidth } from './topbarFit';
import { ActionsMenu } from './shell/ActionsMenu';
import { InsertMenu } from './shell/InsertMenus';
import { HistoryMenu } from './shell/HistoryMenu';
import { helpAttrs } from './shell/controlHelp';
import '../styles/shellTopbar.css';
import '../styles/topbarOverflow.css';
import '../styles/statusFit.css';
import { BRAND_ICON } from '../brandAssets';


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
 * Pasos de ahorro de espacio, en el orden en que se aplican al faltar ancho. Primero pasan al menú "Más"
 * los controles menos usados; los rótulos (`compact`) se quitan solo después; al final, el resto.
 * Importar, Proyecto, Exportar, Deshacer/Rehacer, Acciones y Ajustes nunca se ocultan; el logo es lo último en irse (solo a ~390 px).
 */
const FIT_STEPS = [
  'labels',
  'palette',
  'themes',
  'compact',
  'lang',
  'theme',
  'mcp',
  'ai',
  'history',
  'brand',
  'logo',
] as const;

/** Sin barra vertical de herramientas (pantallas estrechas): las herramientas van al menú «Más». */
const NARROW_QUERY = '(max-width: 900px)';

function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(NARROW_QUERY).matches === true);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
type FitStep = (typeof FIT_STEPS)[number];
type HideId = Exclude<FitStep, 'compact'>;

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
  const setUiDensity = useKuraStore((s) => s.setUiDensity);
  const narrowScreen = useNarrowScreen();
  const activeTool = useKuraStore((s) => s.activeTool);
  const setActiveTool = useKuraStore((s) => s.setActiveTool);
  const pastCount = useKuraStore((s) => s.past.length);
  const futureCount = useKuraStore((s) => s.future.length);
  /** Título de deshacer/rehacer con los pasos disponibles ("Deshacer (Ctrl+Z) · 37 pasos"). */
  const stepTip = (base: 'topbar.undoTip' | 'topbar.redoTip', counted: 'topbar.undoTipCount' | 'topbar.redoTipCount', count: number) =>
    count === 0
      ? t(language, base)
      : count === 1
        ? t(language, `${counted}.one`)
        : t(language, counted, { count });
  const undo = useKuraStore((s) => s.undo);
  const redo = useKuraStore((s) => s.redo);
  const openSettings = useKuraStore((s) => s.openSettings);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
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
    labelKey: 'select' | 'paint' | 'cut' | 'erase' | 'measure';
  }> = [
    { id: 'select', icon: <MousePointer size={13} />, labelKey: 'select' },
    { id: 'paint', icon: <Paintbrush size={13} />, labelKey: 'paint' },
    { id: 'cut', icon: <Scissors size={13} />, labelKey: 'cut' },
    { id: 'erase', icon: <Eraser size={13} />, labelKey: 'erase' },
    { id: 'measure', icon: <Ruler size={13} />, labelKey: 'measure' },
  ];

  // Nivel de ahorro de espacio: 0 = completo, 1 = etiquetas compactas, 2+ = oculta controles en orden.
  const headerRef = useRef<HTMLElement>(null);
  const [level, setLevel] = useState(0);
  const maxLevel = FIT_STEPS.length;
  const applied = FIT_STEPS.slice(0, level);
  const compact = applied.includes('compact');
  const hidden = new Set<HideId>(applied.filter((step): step is HideId => step !== 'compact'));
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
  }, [language, uiDensity, narrowScreen, bridgeStatus.phase, mcpConfig.enabled, mcpConfig.requireAuth, aiDrawerOpen, aiConfig]);

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

  // Rótulos: una sola preferencia (densidad Expandido = con texto, Compacto = solo iconos) para todas las barras.
  const labelsShown = uiDensity !== 'compact';
  const labelsName = t(language, labelsShown ? 'rediseno.labels.hide' : 'rediseno.labels.show');
  const toggleLabels = () => setUiDensity(labelsShown ? 'compact' : 'full');
  // Sin rótulos (preferencia o falta de ancho) el pill conserva «MCP» y su indicador: nunca queda vacío.
  const mcpText = compact || !labelsShown ? t(language, 'r3a.mcp.short') : mcpLabel;

  const brandEl = (
    <div className="kura-brand" title={t(language, 'app.tagline')}>
      <img
        src={BRAND_ICON}
        alt={BRAND.name}
        className="kura-brand-icon-img"
        width={26}
        height={26}
        onClick={handleLogoClick}
      />
      {!isHidden('brand') && (
        <>
          <span className="kura-brand-title">{BRAND.name}</span>
          <button
            type="button"
            className="kura-brand-badge kura-about-version-btn"
            onClick={() => setActiveDialog('about')}
            aria-label={t(language, 'about.badgeLabel', { version: BRAND.version, name: BRAND.name })}
            title={t(language, 'about.menuTip', { name: BRAND.name })}
          >
            {BRAND.version.split('.').slice(0, 2).join('.')}
          </button>
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
  const showMore = hidden.size > 0 || narrowScreen;

  return (
    <header
      ref={headerRef}
      className={`kura-topbar kura-topbar-adaptive ${compact ? 'is-compact' : ''} ${narrowScreen ? 'is-narrow' : ''}`}
    >
      {/* Marca, Archivo, Edición (deshacer, rehacer, historial) y Acciones */}
      <div className="kura-topbar-group kura-topbar-left">
        {!isHidden('logo') && brandEl}

        <div className="kura-topbar-cluster" role="group" aria-label={t(language, 'rediseno.top.file')}>
          <ImportMenuButton />
          <ProjectButton />
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-btn-primary"
            onClick={() => openExportDialog()}
            aria-label={t(language, 'topbar.export')}
            {...helpAttrs('top.export', language)}
          >
            <Download size={13} aria-hidden="true" />
            <span className="kura-btn-label kura-label-keep">{t(language, 'topbar.export')}</span>
          </button>
        </div>

        <div className="kura-topbar-cluster" role="group" aria-label={t(language, 'rediseno.top.edit')}>
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            disabled={pastCount === 0}
            onClick={undo}
            aria-label={t(language, 'topbar.undo')}
            {...helpAttrs('top.undo', language)}
            title={stepTip('topbar.undoTip', 'topbar.undoTipCount', pastCount)}
          >
            <Undo2 size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            disabled={futureCount === 0}
            onClick={redo}
            aria-label={t(language, 'topbar.redo')}
            {...helpAttrs('top.redo', language)}
            title={stepTip('topbar.redoTip', 'topbar.redoTipCount', futureCount)}
          >
            <Redo2 size={14} aria-hidden="true" />
          </button>
          {!isHidden('history') && <HistoryMenu />}
        </div>

        {!narrowScreen && <InsertMenu showLabel={!compact} />}
        <ActionsMenu showLabel={!compact} />
      </div>

      {/* Grupo de utilidades fijado a la derecha */}
      <div className="kura-topbar-group kura-topbar-right">
        {!isHidden('palette') && (
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label={t(language, 'topbar.cmdPalette')}
            {...helpAttrs('top.palette', language)}
          >
            <Search size={13} />
          </button>
        )}

        {!isHidden('lang') && <LanguageMenu />}

        {!isHidden('themes') && (
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            onClick={() => openSettings('appearance')}
            aria-label={t(language, 'topbar.themesShortcut')}
            {...helpAttrs('top.themes', language)}
          >
            <Palette size={13} />
          </button>
        )}

        {!isHidden('theme') && (
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            onClick={handleToggleTheme}
            aria-label={themeTip}
            {...helpAttrs('top.theme', language)}
            title={themeTip}
          >
            {isRenderedDark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        )}

        {!isHidden('labels') && (
          <button
            type="button"
            className={`kura-btn kura-btn-icon kura-btn-sm kura-labels-toggle ${labelsShown ? 'is-active' : ''}`}
            onClick={toggleLabels}
            aria-pressed={labelsShown}
            aria-label={t(language, 'rediseno.labels.toggle')}
            {...helpAttrs('top.labels', language)}
          >
            <CaseSensitive size={15} aria-hidden="true" />
          </button>
        )}

        {!isHidden('mcp') && (
          <button
            type="button"
            className={`kura-pill is-${mcpView.tone}`}
            onClick={() => openSettings('mcp')}
            aria-label={mcpTooltip}
            {...helpAttrs('top.mcp', language)}
            title={mcpTooltip}
          >
            <span className="kura-dot" aria-hidden="true" />
            <span className="kura-mcp-text">{mcpText}</span>
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
            aria-label={t(language, 'topbar.aiChat')}
            aria-pressed={aiDrawerOpen}
            {...helpAttrs('top.ai', language)}
            title={aiTip}
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
            {narrowScreen &&
              tools.map((tool) => <React.Fragment key={tool.id}>{toolButton(tool, true)}</React.Fragment>)}
            {narrowScreen && (
              <button
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm"
                onClick={() => openSettings('appearance')}
                title={t(language, 'topbar.settings')}
              >
                <Settings size={13} aria-hidden="true" />
                <span>{t(language, 'topbar.settings')}</span>
              </button>
            )}
            {narrowScreen && (
              <button
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm"
                onClick={() => setActiveDialog('about')}
                title={t(language, 'about.menuTip', { name: BRAND.name })}
              >
                <Info size={13} aria-hidden="true" />
                <span>{t(language, 'about.title', { name: BRAND.name })}</span>
              </button>
            )}
            {isHidden('lang') && <LanguageRadioItems language={language} onPick={setLanguage} />}
            {isHidden('labels') && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={labelsShown}
                className="kura-btn kura-btn-sm"
                onClick={toggleLabels}
                title={t(language, 'rediseno.help.labels')}
              >
                <CaseSensitive size={13} aria-hidden="true" />
                <span>{labelsName}</span>
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

        {!narrowScreen && (
          <button
            type="button"
            className="kura-btn kura-btn-icon kura-btn-sm"
            onClick={() => openSettings('appearance')}
            aria-label={t(language, 'topbar.settings')}
            {...helpAttrs('top.settings', language)}
          >
            <Settings size={13} />
          </button>
        )}
      </div>
    </header>
  );
};
