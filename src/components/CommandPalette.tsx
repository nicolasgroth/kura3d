/**
 * @file src/components/CommandPalette.tsx
 * @description Paleta rápida de comandos (Ctrl+K) de Kura3D v0.5.0 sobre <dialog> nativo
 * con filtrado en vivo, navegación por teclado (↑/↓/Enter), comandos Maker Pro, selector de
 * apariencia y temas WCAG AA/AAA, ciclo de 6 idiomas, modos de densidad (Compacto/Zen),
 * plano de sección Rayos X y badges explícitos Local vs IA.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Bolt,
  Repeat2,
  RefreshCw,
  Bot,
  Box,
  Circle,
  Cloud,
  Columns2,
  Combine,
  Cone,
  Cylinder,
  Disc,
  Download,
  FileCode2,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  FileUp,
  FileInput,
  Crosshair,
  FlipHorizontal2,
  Grid,
  Grid3x3,
  HelpCircle,
  Hexagon,
  Image as ImageIcon,
  Languages,
  Layers,
  Maximize2,
  Minimize2,
  MinusCircle,
  Moon,
  PaintBucket,
  Palette,
  Ruler,
  ScanSearch,
  Scissors,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Split,
  Type,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { SUPPORTED_LANGUAGES } from '../types/kura';
import { getAiBadgeDescriptor } from '../utils/aiBadges';
import { guardUnsavedChanges } from '../utils/unsavedGuard';
import { openExportDialog } from './ExportDialog';
import { discParams } from '../core/scene/pieceSizing';
import { attachDialogDismissHandlers, closeDialogWithMotion } from '../utils/dialogMotion';
import { rankPaletteItems } from '../utils/paletteRank';
import { REFINE_UI_DEFAULTS } from './refineDefaults';
import { recomputeWithToast, repeatWithToast } from './useFunctionKeys';
import { repeatLabel } from '../store/repeatLabel';
import { isTauriRuntime } from '../utils/platformBridge';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '');
const MOD = isMac ? '⌘' : 'Ctrl';

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
  const lastRepeatable = useKuraStore((s) => s.lastRepeatable);
  const sceneBusy = useKuraStore((s) => Boolean(s.busyOperation) || s.projectBusy);
  const setLanguage = useKuraStore((s) => s.setLanguage);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const setUiDensity = useKuraStore((s) => s.setUiDensity);
  const toggleZenMode = useKuraStore((s) => s.toggleZenMode);
  const sectionPlane = useKuraStore((s) => s.sectionPlane);
  const setSectionPlane = useKuraStore((s) => s.setSectionPlane);
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
  const runPrintabilityCheck = useKuraStore((s) => s.runPrintabilityCheck);
  const simplifySelectedMesh = useKuraStore((s) => s.simplifySelectedMesh);
  const refineSelectedMesh = useKuraStore((s) => s.refineSelectedMesh);
  const runConvexHull = useKuraStore((s) => s.runConvexHull);
  const alignSelectedObjects = useKuraStore((s) => s.alignSelectedObjects);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const openSettings = useKuraStore((s) => s.openSettings);
  const requestMeasuresPopover = useKuraStore((s) => s.requestMeasuresPopover);
  const setAiDrawerOpen = useKuraStore((s) => s.setAiDrawerOpen);
  const importMeshFromDialog = useKuraStore((s) => s.importMeshFromDialog);
  const requestCameraPreset = useKuraStore((s) => s.requestCameraPreset);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const setColorScheme = useKuraStore((s) => s.setColorScheme);
  const detectObjectStructures = useKuraStore((s) => s.detectObjectStructures);
  const colorizeDetectedStructures = useKuraStore((s) => s.colorizeDetectedStructures);
  const mirrorObject = useKuraStore((s) => s.mirrorObject);
  const newProject = useKuraStore((s) => s.newProject);
  const openProject = useKuraStore((s) => s.openProject);
  const saveProject = useKuraStore((s) => s.saveProject);

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
    const catProj = t(language, 'cmd.cat.project');

    return [
      {
        id: 'project-new',
        label: t(language, 'fileProject.new'),
        category: catProj,
        keywords: 'nuevo proyecto escena new project',
        shortcut: `${MOD}+N`,
        kind: 'local',
        icon: <FilePlus size={15} />,
        run: () => guardUnsavedChanges(() => newProject()),
      },
      {
        id: 'project-open',
        label: t(language, 'fileProject.open'),
        category: catProj,
        keywords: 'abrir proyecto kura open project',
        shortcut: `${MOD}+O`,
        kind: 'local',
        icon: <FolderOpen size={15} />,
        run: () => guardUnsavedChanges(() => openProject()),
      },
      {
        id: 'project-save',
        label: t(language, 'fileProject.save'),
        category: catProj,
        keywords: 'guardar proyecto kura save project',
        shortcut: `${MOD}+S`,
        kind: 'local',
        icon: <Save size={15} />,
        run: () => saveProject(),
      },
      {
        id: 'project-save-as',
        label: t(language, 'fileProject.saveAs'),
        category: catProj,
        keywords: 'guardar proyecto como save as',
        shortcut: `${MOD}+Shift+S`,
        kind: 'local',
        icon: <SaveAll size={15} />,
        run: () => saveProject(true),
      },
      {
        id: 'prim-box',
        label: t(language, 'sidebar.primitive.box'),
        category: catPrim,
        keywords: 'cubo caja box cube primitiva',
        kind: 'local',
        icon: <Box size={15} />,
        run: () => void createPrimitive('box', { width: 30, height: 30, depth: 30 }, { placement: 'free' }),
      },
      {
        id: 'prim-cyl',
        label: t(language, 'sidebar.primitive.cylinder'),
        category: catPrim,
        keywords: 'cilindro cylinder tubo',
        kind: 'local',
        icon: <Cylinder size={15} />,
        run: () => void createPrimitive('cylinder', { radius: 14, height: 36 }, { placement: 'free' }),
      },
      {
        id: 'prim-disc',
        label: t(language, 'menu.shape.disc'),
        category: catPrim,
        keywords: 'disco disc arandela moneda base cilindro bajo',
        kind: 'local',
        icon: <Cylinder size={15} />,
        run: () => void createPrimitive('cylinder', { ...discParams(16) }, { placement: 'free', name: t(language, 'menu.shape.disc') }),
      },
      {
        id: 'prim-tube',
        label: t(language, 'sidebar.primitive.tube'),
        category: catPrim,
        keywords: 'tubo hueco tube pipe anillo',
        kind: 'local',
        icon: <Disc size={15} />,
        run: () =>
          void createPrimitive('tube', { outerRadius: 16, innerRadius: 11, height: 36 }, { placement: 'free' }),
      },
      {
        id: 'prim-sphere',
        label: t(language, 'sidebar.primitive.sphere'),
        category: catPrim,
        keywords: 'esfera sphere bola',
        kind: 'local',
        icon: <Circle size={15} />,
        run: () => void createPrimitive('sphere', { radius: 16 }, { placement: 'free' }),
      },
      {
        id: 'prim-cone',
        label: t(language, 'sidebar.primitive.cone'),
        category: catPrim,
        keywords: 'cono cone piramide',
        kind: 'local',
        icon: <Cone size={15} />,
        run: () => void createPrimitive('cone', { radius: 16, height: 34 }, { placement: 'free' }),
      },
      {
        id: 'prim-torus',
        label: t(language, 'sidebar.primitive.torus'),
        category: catPrim,
        keywords: 'toroide torus dona',
        kind: 'local',
        icon: <Sparkles size={15} />,
        run: () => void createPrimitive('torus', { outerRadius: 18, tubeRadius: 5.5 }, { placement: 'free' }),
      },
      {
        id: 'prim-prism',
        label: t(language, 'sidebar.primitive.prism'),
        category: catPrim,
        keywords: 'prisma hexagono prism',
        kind: 'local',
        icon: <Hexagon size={15} />,
        run: () => void createPrimitive('prism', { radius: 16, height: 28, sides: 6 }, { placement: 'free' }),
      },
      {
        id: 'prim-text',
        label: `${t(language, 'sidebar.primitive.text')} ("KURA3D")`,
        category: catPrim,
        keywords: 'texto 3d text letra',
        kind: 'local',
        icon: <Type size={15} />,
        run: () => void createPrimitive('text', { text: 'KURA3D', fontSize: 18, height: 6 }, { placement: 'free' }),
      },
      {
        id: 'gen-thread',
        label: t(language, 'cmd.pro.thread'),
        category: catPrim,
        keywords: 'rosca tornillo perno tuerca iso thread bolt nut m4 m6 m8 m10',
        kind: 'local',
        icon: <Bolt size={15} />,
        run: () => setActiveDialog('thread'),
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
        keywords: 'imagen relieve litofania cilindrica silueta cortador image lithophane cutter',
        kind: 'local',
        icon: <ImageIcon size={15} />,
        run: () => setActiveDialog('image'),
      },
      {
        id: 'op-mold',
        shortcut: 'Shift+M',
        label: t(language, 'cmd.pro.mold'),
        category: catOps,
        keywords: 'molde silicona vela resina contramolde mold silicone candle',
        kind: 'local',
        icon: <PaintBucket size={15} />,
        run: () => setActiveDialog('mold'),
      },
      {
        id: 'op-project',
        label: t(language, 'cmd.pro.project'),
        category: catOps,
        keywords: 'proyectar texto svg superficie relieve grabado incrustacion project surface',
        kind: 'local',
        icon: <Type size={15} />,
        run: () => setActiveDialog('project'),
      },
      {
        id: 'op-validate',
        label: t(language, 'cmd.pro.validate'),
        category: catOps,
        keywords: 'validar imprimibilidad voladizos peso filamento overhangs printability check',
        kind: 'local',
        icon: <ShieldCheck size={15} />,
        run: () => {
          if (primaryId) runPrintabilityCheck(primaryId);
        },
      },
      {
        id: 'op-detect-structures',
        label: t(language, 'cmd.pro.detectStructures'),
        category: catOps,
        keywords: 'detectar estructuras sub-partes segmentar local pliegues islas detect structures',
        kind: 'local',
        icon: <ScanSearch size={15} />,
        run: () => {
          if (primaryId) void detectObjectStructures(primaryId);
        },
      },
      {
        id: 'op-colorize-structures',
        label: t(language, 'cmd.pro.colorizeStructures'),
        category: catOps,
        keywords: 'colorear estructuras sub-partes multicolor 3mf colorize structures',
        kind: 'local',
        icon: <Palette size={15} />,
        run: () => {
          if (primaryId) void colorizeDetectedStructures(primaryId);
        },
      },
      {
        id: 'op-mirror-x',
        label: t(language, 'cmd.pro.mirrorX'),
        category: catOps,
        keywords: 'espejar simetria reflejar mirror x axis',
        kind: 'local',
        icon: <FlipHorizontal2 size={15} />,
        run: () => {
          if (primaryId) mirrorObject(primaryId, 'x');
        },
      },
      {
        id: 'op-simplify',
        label: t(language, 'cmd.pro.simplify'),
        category: catOps,
        keywords: 'simplificar reducir triangulos malla decimate simplify mesh',
        kind: 'local',
        icon: <Sparkles size={15} />,
        run: () => {
          if (primaryId) void simplifySelectedMesh(primaryId, 0.15);
        },
      },
      {
        id: 'op-refine',
        label: t(language, 'cmd.pro.refine'),
        category: catOps,
        keywords: 'refinar subdividir suavizar malla refine smooth mesh',
        kind: 'local',
        icon: <Wand2 size={15} />,
        run: () => {
          if (primaryId) void refineSelectedMesh(primaryId, REFINE_UI_DEFAULTS.edgeMm, REFINE_UI_DEFAULTS.smooth);
        },
      },
      {
        id: 'op-hull',
        label: t(language, 'cmd.pro.hull'),
        category: catOps,
        keywords: 'envolvente convexa convex hull unir',
        kind: 'local',
        icon: <Box size={15} />,
        run: () => void runConvexHull(),
      },
      {
        id: 'op-arrange',
        label: t(language, 'cmd.pro.arrangeGrid'),
        category: catOps,
        keywords: 'distribuir cama alinear rejilla arrange grid bed',
        kind: 'local',
        icon: <Grid size={15} />,
        run: () => alignSelectedObjects('arrange_grid'),
      },
      ...(lastRepeatable
        ? [{
            id: 'edit-repeat',
            label: t(language, 'repeat.label', { name: repeatLabel(language, lastRepeatable) }),
            category: catOps,
            keywords: 'repetir ultima accion repeat last action f4',
            shortcut: 'F4',
            kind: 'local' as const,
            icon: <Repeat2 size={15} />,
            run: () => void repeatWithToast(),
          }]
        : []),
      {
        id: 'op-recompute',
        label: t(language, 'menu.recompute'),
        category: catOps,
        keywords: 'recalcular regenerar parametrico recompute regenerate parametric f5',
        shortcut: isTauriRuntime() ? 'F5' : 'Shift+F5',
        kind: 'local',
        icon: <RefreshCw size={15} />,
        run: () => void recomputeWithToast(),
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
        shortcut: 'C',
        label: t(language, 'inspector.op.planeCut'),
        category: catOps,
        keywords: 'cortar plano uniones tarugo dovetail cut',
        kind: 'local',
        icon: <Scissors size={15} />,
        run: () => setActiveDialog('cut'),
      },
      {
        id: 'op-split-for-bed',
        shortcut: 'Shift+C',
        label: t(language, 'split.open'),
        category: catOps,
        keywords: 'dividir imprimir cama piezas trozos grande split bed tiles print',
        kind: 'local',
        icon: <Grid3x3 size={15} />,
        run: () => setActiveDialog('splitForBed'),
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
          if (primaryId) void splitObjectByColor(primaryId);
        },
      },
      {
        id: 'op-drop-bed',
        shortcut: 'L',
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
        id: 'op-center-bed',
        label: t(language, 'ctx.centerOnBed'),
        category: catOps,
        keywords: 'centrar cama centro center bed xy',
        kind: 'local',
        icon: <Crosshair size={15} />,
        run: () => void useKuraStore.getState().centerSelectionOnBed(),
      },
      {
        id: 'op-replace-mesh',
        label: t(language, 'menu.more.replace'),
        category: catOps,
        keywords: 'reemplazar archivo malla stl 3mf obj sustituir replace file mesh',
        kind: 'local',
        icon: <FileInput size={15} />,
        run: () => {
          if (primaryId) void useKuraStore.getState().replaceObjectMeshFromDialog(primaryId);
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
        id: 'io-import-original',
        label: t(language, 'cmd.import.original'),
        category: catExp,
        keywords: 'importar posicion original altura conservar 3mf ensamblaje import keep original position',
        kind: 'local',
        icon: <FileUp size={15} />,
        run: () => void importMeshFromDialog('original'),
      },
      {
        id: 'io-import-bed',
        label: t(language, 'cmd.import.bed'),
        category: catExp,
        keywords: 'importar cama apoyar centrar import bed place',
        kind: 'local',
        icon: <FileUp size={15} />,
        run: () => void importMeshFromDialog('bed'),
      },
      {
        id: 'io-export',
        label: t(language, 'cmd.export.dialog'),
        category: catExp,
        keywords: 'exportar export stl 3mf obj mtl glb gltf ply guardar',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => openExportDialog(),
      },
      {
        id: 'io-stl',
        label: t(language, 'topbar.exportStl'),
        category: catExp,
        keywords: 'exportar stl imprimir slicer',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => openExportDialog('stl'),
      },
      {
        id: 'io-stl-selection',
        label: t(language, 'menu.more.exportStl'),
        category: catExp,
        keywords: 'exportar seleccion stl un solo archivo selection export',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => openExportDialog('stl', 'selection'),
      },
      {
        id: 'io-3mf-modal',
        label: t(language, 'cmd.export.3mfModal'),
        category: catExp,
        keywords: 'exportar 3mf slicer orca bambu prusa cura multicolor',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => openExportDialog('3mf'),
      },
      {
        id: 'io-obj',
        label: t(language, 'topbar.exportObj'),
        category: catExp,
        keywords: 'exportar obj mtl wavefront colores',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => openExportDialog('obj'),
      },
      {
        id: 'io-glb',
        label: t(language, 'cmd.export.glb'),
        category: catExp,
        keywords: 'exportar glb gltf web visor',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => openExportDialog('glb'),
      },
      {
        id: 'io-ply',
        label: t(language, 'cmd.export.ply'),
        category: catExp,
        keywords: 'exportar ply stanford colores vertice',
        kind: 'local',
        icon: <Download size={15} />,
        run: () => openExportDialog('ply'),
      },
      {
        id: 'view-compact',
        label: t(language, 'cmd.view.compact'),
        category: catView,
        keywords: 'compacto densidad laptop rail sidebar compact',
        kind: 'local',
        icon: <Columns2 size={15} />,
        run: () => setUiDensity(uiDensity === 'compact' ? 'full' : 'compact'),
      },
      {
        id: 'view-zen',
        label: t(language, 'cmd.view.zen'),
        category: catView,
        keywords: 'zen pantalla completa canvas hide panels',
        shortcut: `${MOD}+Shift+Enter`,
        kind: 'local',
        icon: <Minimize2 size={15} />,
        run: () => toggleZenMode(),
      },
      {
        id: 'view-xray',
        shortcut: 'X',
        label: t(language, 'cmd.view.xray'),
        category: catView,
        keywords: 'rayos x seccion corte visual clipping xray section',
        kind: 'local',
        icon: <Layers size={15} />,
        run: () => setSectionPlane({ enabled: !sectionPlane.enabled }),
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
        label: (() => {
          const nextIdx =
            (SUPPORTED_LANGUAGES.findIndex((l) => l.code === language) + 1) %
            SUPPORTED_LANGUAGES.length;
          const nextLang = SUPPORTED_LANGUAGES[nextIdx];
          return `${t(language, 'topbar.languageToggle')} (${nextLang.shortLabel} · ${nextLang.nativeName})`;
        })(),
        category: catView,
        keywords:
          'idioma language sprache langue spanish english deutsch francais hindi chinese español ingles aleman frances',
        kind: 'local',
        icon: <Languages size={15} />,
        run: () => {
          const nextIdx =
            (SUPPORTED_LANGUAGES.findIndex((l) => l.code === language) + 1) %
            SUPPORTED_LANGUAGES.length;
          setLanguage(SUPPORTED_LANGUAGES[nextIdx].code);
        },
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
        id: 'set-appearance',
        label: t(language, 'palette.cmd.appearance'),
        category: catSet,
        keywords:
          'apariencia colores tema wcag obsidian prism carbon nordic amber contrast theme appearance',
        kind: 'local',
        icon: <Palette size={15} />,
        run: () => openSettings('appearance'),
      },
      {
        id: 'set-unit',
        label: t(language, 'palette.cmd.changeUnit'),
        category: catSet,
        keywords: 'unidad medida mm cm pulgadas unit measure inches millimetres',
        kind: 'local',
        icon: <Ruler size={15} />,
        run: () => requestMeasuresPopover('unit'),
      },
      {
        id: 'set-printer',
        label: t(language, 'palette.cmd.changePrinter'),
        category: catSet,
        keywords: 'impresora perfil cama volumen printer profile bed elegoo bambu',
        kind: 'local',
        icon: <Ruler size={15} />,
        run: () => requestMeasuresPopover('printer'),
      },
      {
        id: 'view-shortcuts',
        label: t(language, 'cmd.view.shortcuts'),
        category: catView,
        keywords: 'atajos teclado ayuda pro tips shortcuts help f1 ?',
        shortcut: '?',
        kind: 'local',
        icon: <HelpCircle size={15} />,
        run: () => setActiveDialog('shortcuts'),
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
        shortcut: `${MOD}+,`,
        label: t(language, 'dialog.settings.tab.ai'),
        category: catSet,
        keywords: 'ajustes configuracion api key ai settings',
        kind: 'local',
        icon: <Settings size={15} />,
        run: () => openSettings('ai'),
      },
    ];
  }, [
    newProject,
    openProject,
    saveProject,
    language,
    aiBadge,
    primaryId,
    lastRepeatable,
    colorScheme,
    uiDensity,
    sectionPlane.enabled,
    createPrimitive,
    addSubtractHelperPrimitive,
    applyHolesOnSolids,
    runBooleanOnSelection,
    hollowObject,
    splitDisconnectedObject,
    splitObjectByColor,
    dropObjectToBed,
    runPrintabilityCheck,
    simplifySelectedMesh,
    refineSelectedMesh,
    runConvexHull,
    alignSelectedObjects,
    setActiveDialog,
    importMeshFromDialog,
    setUiDensity,
    toggleZenMode,
    setSectionPlane,
    requestCameraPreset,
    setLanguage,
    setColorScheme,
    setAiDrawerOpen,
    openSettings,
    detectObjectStructures,
    colorizeDetectedStructures,
    mirrorObject,
  ]);

  const filtered = useMemo(() => rankPaletteItems(actions, query), [actions, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  /** Crear, operar o importar mientras otra operación corre se bloquea (la exclusión del store la rechazaría). */
  const blockedByBusy = (item: PaletteActionItem) =>
    sceneBusy &&
    (item.category === t(language, 'cmd.cat.primitives') ||
      item.category === t(language, 'cmd.cat.operations') ||
      item.id.startsWith('io-import'));

  const executeItem = (item: PaletteActionItem | undefined) => {
    if (!item || blockedByBusy(item)) return;
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
    } else if (
      e.key === 'Enter' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      !e.altKey &&
      filtered[activeIndex]
    ) {
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
          role="combobox"
          aria-label={t(language, 'cmd.inputLabel')}
          aria-expanded={filtered.length > 0}
          aria-controls={`${titleId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={filtered[activeIndex] ? `${titleId}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
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

      <div
        className="kura-palette-list"
        role="listbox"
        id={`${titleId}-list`}
        aria-label={t(language, 'cmd.resultsLabel')}
      >
        {filtered.length === 0 ? (
          <div className="kura-palette-empty" role="status">{t(language, 'cmd.empty')}</div>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={item.id}
              id={`${titleId}-opt-${idx}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={idx === activeIndex}
              aria-disabled={blockedByBusy(item) || undefined}
              title={blockedByBusy(item) ? t(language, 'store.error.busy') : undefined}
              className={`kura-palette-item ${idx === activeIndex ? 'is-active' : ''} ${blockedByBusy(item) ? 'is-disabled' : ''}`}
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
