/**
 * @file src/components/CommandPalette.tsx
 * @description Paleta rápida de comandos (Ctrl+K) sobre <dialog> nativo con filtrado en vivo,
 * navegación por teclado (↑/↓/Enter), atajos visibles y badges explícitos Local vs IA.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Bot,
  Box,
  Circle,
  Cloud,
  Combine,
  Cone,
  Cylinder,
  Disc,
  Download,
  FileCode2,
  FileUp,
  Hexagon,
  Image as ImageIcon,
  Languages,
  Maximize2,
  MinusCircle,
  Moon,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Split,
  Type,
  X,
  Zap,
} from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { getAiBadgeDescriptor } from '../utils/aiBadges';
import { attachDialogDismissHandlers, closeDialogWithMotion } from '../utils/dialogMotion';

interface PaletteActionItem {
  id: string;
  label: string;
  category: string;
  keywords: string;
  shortcut?: string;
  kind: 'local' | 'ai';
  icon: React.ReactNode;
  run: () => void | Promise<void>;
}

export const CommandPalette: React.FC = () => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const open = useKuraStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useKuraStore((s) => s.setCommandPaletteOpen);
  const language = useKuraStore((s) => s.language);
  const setLanguage = useKuraStore((s) => s.setLanguage);
  const aiConfig = useKuraStore((s) => s.aiConfig);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const createPrimitive = useKuraStore((s) => s.createPrimitive);
  const addSubtractHelperPrimitive = useKuraStore((s) => s.addSubtractHelperPrimitive);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const runBooleanOnSelection = useKuraStore((s) => s.runBooleanOnSelection);
  const hollowObject = useKuraStore((s) => s.hollowObject);
  const splitDisconnectedObject = useKuraStore((s) => s.splitDisconnectedObject);
  const splitObjectByColor = useKuraStore((s) => s.splitObjectByColor);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const openSettings = useKuraStore((s) => s.openSettings);
  const setAiDrawerOpen = useKuraStore((s) => s.setAiDrawerOpen);
  const importMeshFromDialog = useKuraStore((s) => s.importMeshFromDialog);
  const exportSceneStl = useKuraStore((s) => s.exportSceneStl);
  const exportScene3mf = useKuraStore((s) => s.exportScene3mf);
  const exportSelectedObj = useKuraStore((s) => s.exportSelectedObj);
  const requestCameraPreset = useKuraStore((s) => s.requestCameraPreset);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const setColorScheme = useKuraStore((s) => s.setColorScheme);

  const aiBadge = getAiBadgeDescriptor(aiConfig, language);
  const primaryId = selectedIds[0] ?? objects[0]?.id;

  const closePalette = () => {
    const dialog = dialogRef.current;
    if (dialog && dialog.open) {
      void closeDialogWithMotion(dialog);
    } else {
      setCommandPaletteOpen(false);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setQuery('');
      setActiveIndex(0);
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      void closeDialogWithMotion(dialog);
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      setCommandPaletteOpen(false);
    };
    dialog.addEventListener('close', handleClose);
    const detachDismiss = attachDialogDismissHandlers(dialog);

    return () => {
      dialog.removeEventListener('close', handleClose);
      detachDismiss();
    };
  }, [setCommandPaletteOpen]);

  const actions = useMemo<PaletteActionItem[]>(() => {
    const catPrim = t(language, 'cmd.cat.primitives');
    const catOps = t(language, 'cmd.cat.operations');
    const catExp = t(language, 'cmd.cat.export');
    const catView = t(language, 'cmd.cat.view');
    const catSet = t(language, 'cmd.cat.settings');

    return [
      {
        id: 'prim-box',
        label: t(language, 'sidebar.primitive.box'),
        category: catPrim,
        keywords: 'cubo caja box cube primitiva',
        kind: 'local',
        icon: <Box size={15} />,
        run: () => void createPrimitive('box', { width: 30, height: 30, depth: 30 }),
      },
      {
        id: 'prim-cyl',
        label: t(language, 'sidebar.primitive.cylinder'),
        category: catPrim,
        keywords: 'cilindro cylinder tubo',
        kind: 'local',
        icon: <Cylinder size={15} />,
        run: () => void createPrimitive('cylinder', { radius: 14, height: 36 }),
      },
      {
        id: 'prim-tube',
        label: t(language, 'sidebar.primitive.tube'),
        category: catPrim,
        keywords: 'tubo hueco tube pipe anillo',
        kind: 'local',
        icon: <Disc size={15} />,
        run: () =>
          void createPrimitive('tube', { outerRadius: 16, innerRadius: 11, height: 36 }),
      },
      {
        id: 'prim-sphere',
        label: t(language, 'sidebar.primitive.sphere'),
        category: catPrim,
        keywords: 'esfera sphere bola',
        kind: 'local',
        icon: <Circle size={15} />,
        run: () => void createPrimitive('sphere', { radius: 16 }),
      },
      {
        id: 'prim-cone',
        label: t(language, 'sidebar.primitive.cone'),
        category: catPrim,
        keywords: 'cono cone piramide',
        kind: 'local',
        icon: <Cone size={15} />,
        run: () => void createPrimitive('cone', { radius: 16, height: 34 }),
      },
      {
        id: 'prim-torus',
        label: t(language, 'sidebar.primitive.torus'),
        category: catPrim,
        keywords: 'toroide torus dona',
        kind: 'local',
        icon: <Sparkles size={15} />,
        run: () => void createPrimitive('torus', { outerRadius: 18, tubeRadius: 5.5 }),
      },
      {
        id: 'prim-prism',
        label: t(language, 'sidebar.primitive.prism'),
        category: catPrim,
        keywords: 'prisma hexagono prism',
        kind: 'local',
        icon: <Hexagon size={15} />,
        run: () => void createPrimitive('prism', { radius: 16, height: 28, sides: 6 }),
      },
      {
        id: 'prim-text',
        label: `${t(language, 'sidebar.primitive.text')} ("KURA3D")`,
        category: catPrim,
        keywords: 'texto 3d text letra',
        kind: 'local',
        icon: <Type size={15} />,
        run: () => void createPrimitive('text', { text: 'KURA3D', fontSize: 18, height: 6 }),
      },
      {
        id: 'gen-svg',
        label: t(language, 'topbar.importSvg'),
        category: catPrim,
        keywords: 'svg extruir vector',
        kind: 'local',
        icon: <FileCode2 size={15} />,
        run: () => setActiveDialog('svg'),
      },
      {
        id: 'gen-img',
        label: t(language, 'topbar.imageTo3d'),
        category: catPrim,
        keywords: 'imagen relieve litofania image lithophane',
        kind: 'local',
        icon: <ImageIcon size={15} />,
        run: () => setActiveDialog('image'),
      },
      {
        id: 'op-sub-sphere',
        label: t(language, 'inspector.op.subtractSphere'),
        category: catOps,
        keywords: 'restar quitar esfera cavidad hueco subtract sphere',
        kind: 'local',
        icon: <MinusCircle size={15} />,
        run: () => void addSubtractHelperPrimitive('sphere', primaryId),
      },
      {
        id: 'op-sub-cyl',
        label: t(language, 'inspector.op.subtractCylinder'),
        category: catOps,
        keywords: 'restar quitar cilindro tunel agujero subtract cylinder',
        kind: 'local',
        icon: <MinusCircle size={15} />,
        run: () => void addSubtractHelperPrimitive('cylinder', primaryId),
      },
      {
        id: 'op-apply-holes',
        label: t(language, 'inspector.op.applyHoles'),
        category: catOps,
        keywords: 'aplicar restas huecos boolean subtract',
        kind: 'local',
        icon: <Combine size={15} />,
        run: () => void applyHolesOnSolids(),
      },
      {
        id: 'op-union',
        label: `${t(language, 'inspector.op.booleanTitle')}: ${t(language, 'inspector.op.union')}`,
        category: catOps,
        keywords: 'unir union booleana csg',
        kind: 'local',
        icon: <Combine size={15} />,
        run: () => void runBooleanOnSelection('union'),
      },
      {
        id: 'op-hollow',
        label: `${t(language, 'inspector.op.hollowTitle')} (2.2 mm)`,
        category: catOps,
        keywords: 'ahuecar shell cascara vaciar hollow',
        kind: 'local',
        icon: <Box size={15} />,
        run: () => {
          if (primaryId) {
            void hollowObject(primaryId, { enabled: true, wallThickness: 2.2 });
          }
        },
      },
      {
        id: 'op-cut',
        label: t(language, 'inspector.op.planeCut'),
        category: catOps,
        keywords: 'cortar plano uniones tarugo dovetail cut',
        kind: 'local',
        icon: <Scissors size={15} />,
        run: () => setActiveDialog('cut'),
      },
      {
        id: 'op-split-parts',
        label: t(language, 'inspector.op.splitParts'),
        category: catOps,
        keywords: 'separar piezas islas split parts',
        kind: 'local',
        icon: <Split size={15} />,
        run: () => {
          if (primaryId) void splitDisconnectedObject(primaryId);
        },
      },
      {
        id: 'op-split-colors',
        label: t(language, 'inspector.op.splitColors'),
        category: catOps,
        keywords: 'separar colores multicolor split colors',
        kind: 'local',
        icon: <Sparkles size={15} />,
        run: () => {
          if (primaryId) splitObjectByColor(primaryId);
        },
      },
      {
        id: 'op-drop-bed',
        label: t(language, 'inspector.action.dropToBed'),
        category: catOps,
        keywords: 'apoyar cama suelo drop bed y=0',
        kind: 'local',
        icon: <ArrowDownToLine size={15} />,
        run: () => {
          if (primaryId) dropObjectToBed(primaryId);
        },
      },
      {
        id: 'io-import',
        label: t(language, 'topbar.importModel'),
        category: catExp,
        keywords: 'importar stl 3mf obj abrir',
        kind: 'local',
        icon: <FileUp size={15} />,
        run: () => void importMeshFromDialog(),
      },
      {
        id: 'io-stl',
        label: t(language, 'topbar.exportStl'),
        category: catExp,
        keywords: 'exportar stl imprimir slicer',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => void exportSceneStl(false),
      },
      {
        id: 'io-3mf',
        label: t(language, 'topbar.export3mf'),
        category: catExp,
        keywords: 'exportar 3mf multicolor bambu orca',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => void exportScene3mf(false),
      },
      {
        id: 'io-obj',
        label: t(language, 'topbar.exportObj'),
        category: catExp,
        keywords: 'exportar obj wavefront',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => void exportSelectedObj(),
      },
      {
        id: 'view-fit',
        label: t(language, 'viewport.camera.fit'),
        category: catView,
        keywords: 'encuadrar centrar camara zoom fit',
        shortcut: 'F',
        kind: 'local',
        icon: <Maximize2 size={15} />,
        run: () => requestCameraPreset('fit'),
      },
      {
        id: 'view-lang',
        label: `${t(language, 'topbar.languageToggle')} (${language === 'es' ? 'EN' : 'ES'})`,
        category: catView,
        keywords: 'idioma language spanish english español ingles',
        kind: 'local',
        icon: <Languages size={15} />,
        run: () => setLanguage(language === 'es' ? 'en' : 'es'),
      },
      {
        id: 'view-theme',
        label: t(language, 'topbar.themeToggle'),
        category: catView,
        keywords: 'tema oscuro claro theme dark light',
        kind: 'local',
        icon: <Moon size={15} />,
        run: () => setColorScheme(colorScheme === 'light' ? 'dark' : 'light'),
      },
      {
        id: 'set-ai-drawer',
        label: `${t(language, 'topbar.aiChat')} (${aiBadge.label})`,
        category: catSet,
        keywords: 'asistente ia chat gemini openai claude ollama',
        kind: aiBadge.mode === 'external' ? 'ai' : 'local',
        icon: <Bot size={15} />,
        run: () => setAiDrawerOpen(true),
      },
      {
        id: 'set-mcp',
        label: t(language, 'dialog.settings.tab.mcp'),
        category: catSet,
        keywords: 'mcp servidor websocket token puerto antigravity claude',
        kind: 'local',
        icon: <Settings size={15} />,
        run: () => openSettings('mcp'),
      },
      {
        id: 'set-ai',
        label: t(language, 'dialog.settings.tab.ai'),
        category: catSet,
        keywords: 'ajustes configuracion api key ai settings',
        kind: 'local',
        icon: <Settings size={15} />,
        run: () => openSettings('ai'),
      },
    ];
  }, [
    language,
    aiBadge,
    primaryId,
    colorScheme,
    createPrimitive,
    addSubtractHelperPrimitive,
    applyHolesOnSolids,
    runBooleanOnSelection,
    hollowObject,
    splitDisconnectedObject,
    splitObjectByColor,
    dropObjectToBed,
    setActiveDialog,
    importMeshFromDialog,
    exportSceneStl,
    exportScene3mf,
    exportSelectedObj,
    requestCameraPreset,
    setLanguage,
    setColorScheme,
    setAiDrawerOpen,
    openSettings,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeItem = (item: PaletteActionItem | undefined) => {
    if (!item) return;
    closePalette();
    void item.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length === 0 ? 0 : (prev + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0 ? 0 : (prev - 1 + filtered.length) % filtered.length,
      );
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      executeItem(filtered[activeIndex]);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="kura-dialog kura-palette-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="kura-palette-search-row">
        <Search size={16} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
        <h2 id={titleId} className="sr-only">
          {t(language, 'cmd.title')}
        </h2>
        <input
          ref={inputRef}
          className="kura-palette-input"
          placeholder={t(language, 'cmd.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <kbd className="kura-kbd">Esc</kbd>
        <button
          type="button"
          className="kura-mini-icon-btn"
          onClick={closePalette}
          aria-label={t(language, 'common.close')}
        >
          <X size={15} />
        </button>
      </div>

      <div className="kura-palette-list" role="listbox">
        {filtered.length === 0 ? (
          <div className="kura-palette-empty">{t(language, 'cmd.empty')}</div>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={idx === activeIndex}
              className={`kura-palette-item ${idx === activeIndex ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => executeItem(item)}
            >
              <span className="kura-palette-item-left">
                <span className="kura-palette-icon">{item.icon}</span>
                <span className="kura-palette-texts">
                  <span className="kura-palette-label">{item.label}</span>
                  <span className="kura-palette-cat">{item.category}</span>
                </span>
              </span>
              <span className="kura-palette-item-right">
                {item.shortcut && <kbd className="kura-kbd">{item.shortcut}</kbd>}
                <span className={`kura-source-pill ${item.kind === 'ai' ? 'is-ai' : 'is-local'}`}>
                  {item.kind === 'ai' ? <Cloud size={11} /> : <Zap size={11} />}
                  <span>
                    {item.kind === 'ai'
                      ? t(language, 'cmd.badgeAi')
                      : t(language, 'cmd.badgeLocal')}
                  </span>
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </dialog>
  );
};
