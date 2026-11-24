/**
 * @file src/components/dialogs/ShortcutsModal.tsx
 * @description Diálogo de referencia rápida de atajos de teclado y consejos CAD.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Keyboard } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { NativeModal } from '../NativeModal';

/** Modal 9: Hoja de referencia rápida de Atajos de Teclado Pro y Consejos CAD. */
export const ShortcutsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const historyMaxSteps = useKuraStore((s) => s.historyLimits.maxSteps);

  const sections: Array<{
    title: string;
    items: Array<{ keys: string[]; label: string }>;
  }> = [
    {
      title: t(language, 'dialog.shortcuts.secTransform'),
      items: [
        { keys: ['M'], label: t(language, 'dialog.shortcuts.moveAll') },
        { keys: ['R'], label: t(language, 'dialog.shortcuts.rotateGizmo') },
        { keys: ['S'], label: t(language, 'dialog.shortcuts.scaleGizmo') },
        { keys: ['V'], label: t(language, 'dialog.shortcuts.selectTool') },
        { keys: ['Shift'], label: t(language, 'dialog.shortcuts.shiftScale') },
        { keys: ['Ctrl'], label: t(language, 'dialog.shortcuts.ctrlSnap') },
        { keys: ['Alt', 'Drag'], label: t(language, 'dialog.shortcuts.altClone') },
        { keys: ['↑', '↓', '←', '→'], label: t(language, 'dialog.shortcuts.nudgeXY') },
        { keys: ['PgUp', 'PgDn'], label: t(language, 'dialog.shortcuts.nudgeHeight') },
      ],
    },
    {
      title: t(language, 'dialog.shortcuts.secPrecision'),
      items: [
        { keys: ['X/Y/Z', '↔'], label: t(language, 'dialog.shortcuts.scrubDrag') },
        { keys: ['↑', '↓', 'Wheel'], label: t(language, 'dialog.shortcuts.arrowStep') },
        { keys: ['Shift', '↑/↓'], label: t(language, 'dialog.shortcuts.shiftStep') },
        { keys: ['Alt/Ctrl', '↑/↓'], label: t(language, 'dialog.shortcuts.altStep') },
        { keys: ['2× Clic'], label: t(language, 'dialog.shortcuts.sliderReset') },
      ],
    },
    {
      title: t(language, 'dialog.shortcuts.secCamera'),
      items: [
        { keys: ['1'], label: t(language, 'dialog.shortcuts.camFront') },
        { keys: ['2'], label: t(language, 'dialog.shortcuts.camRight') },
        { keys: ['3'], label: t(language, 'dialog.shortcuts.camIso') },
        { keys: ['7'], label: t(language, 'dialog.shortcuts.camTop') },
        { keys: ['F'], label: t(language, 'dialog.shortcuts.camFit') },
        { keys: ['B'], label: t(language, 'ux6.bed.shortcut') },
        { keys: ['Ctrl/⌘+Shift+Enter'], label: t(language, 'dialog.shortcuts.zenMode') },
      ],
    },
    {
      title: t(language, 'dialog.shortcuts.secCad'),
      items: [
        { keys: ['Ctrl/⌘+G'], label: t(language, 'dialog.shortcuts.group') },
        { keys: ['Ctrl/⌘+Shift+G'], label: t(language, 'dialog.shortcuts.ungroup') },
        { keys: ['Enter', 'Esc'], label: t(language, 'dialog.shortcuts.enterGroup') },
        { keys: ['Ctrl/⌘+Shift+U'], label: t(language, 'dialog.shortcuts.smartGroup') },
        { keys: ['Shift+M'], label: t(language, 'dialog.shortcuts.openMold') },
        { keys: ['X'], label: t(language, 'dialog.shortcuts.toggleXray') },
        { keys: ['P'], label: t(language, 'dialog.shortcuts.togglePaint') },
        { keys: ['D'], label: t(language, 'dialog.shortcuts.measureTool') },
        { keys: ['[', ']'], label: t(language, 'dialog.shortcuts.brushSize') },
        { keys: ['C'], label: t(language, 'dialog.shortcuts.openCut') },
        { keys: ['Shift+C'], label: t(language, 'split.open') },
        { keys: ['L'], label: t(language, 'dialog.shortcuts.dropBed') },
        { keys: ['H'], label: t(language, 'dialog.shortcuts.toggleHole') },
        { keys: ['Shift+H'], label: t(language, 'ux8.shortcuts.toggleVisible') },
        { keys: ['↔'], label: t(language, 'ux10.shortcuts.dragMove') },
      ],
    },
    {
      title: t(language, 'dialog.shortcuts.secPalette'),
      items: [
        { keys: ['Ctrl+K'], label: t(language, 'dialog.shortcuts.cmdPalette') },
        { keys: ['Ctrl+Z / Y'], label: t(language, 'dialog.shortcuts.undoRedoMax', { max: historyMaxSteps }) },
        { keys: ['Ctrl/Shift+D'], label: t(language, 'dialog.shortcuts.duplicate') },
        { keys: ['Del'], label: t(language, 'dialog.shortcuts.delete') },
        { keys: ['F2'], label: t(language, 'dialog.shortcuts.rename') },
        { keys: ['F3'], label: t(language, 'dialog.shortcuts.find') },
        { keys: ['F4'], label: t(language, 'dialog.shortcuts.repeat') },
        { keys: ['Shift+F5'], label: t(language, 'dialog.shortcuts.recompute') },
        { keys: ['?', 'F1'], label: t(language, 'dialog.shortcuts.help') },
      ],
    },
  ];

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.shortcuts.title')}
      className="kura-dialog-wide"
      footer={
        <button type="button" className="kura-btn kura-btn-primary" onClick={onClose}>
          <Keyboard size={14} />
          <span>{t(language, 'dialog.close')}</span>
        </button>
      }
    >
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
        {t(language, 'dialog.shortcuts.subtitle')}
      </p>

      <div className="kura-shortcuts-grid">
        {sections.map((sec) => (
          <section key={sec.title} className="kura-card kura-shortcut-card">
            <h3 className="kura-section-label">{sec.title}</h3>
            <div className="kura-shortcut-list">
              {sec.items.map((item) => (
                <div key={item.label} className="kura-shortcut-row">
                  <span className="kura-shortcut-desc">{item.label}</span>
                  <span className="kura-shortcut-keys">
                    {item.keys.map((k) => (
                      <kbd key={k} className="kura-kbd">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </NativeModal>
  );
};
