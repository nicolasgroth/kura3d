/**
 * @file src/components/split/AssemblyInstructionsPanel.tsx
 * @description Panel «Instrucciones de armado» (acción de escena del panel derecho, con «Volver» y Esc del
 * `ActionPanel`): pasos numerados de una lista ordenada real para armar el grupo dividido de la selección, con sus
 * avisos, la lista de materiales y las descargas en Markdown y HTML imprimible. Enfocar o pulsar un paso selecciona
 * sus piezas en el visor (la selección de siempre). El grupo se recuerda mientras la selección no apunte a otro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import '../../styles/assemblyInstructions.css';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, FileDown } from 'lucide-react';
import { t } from '../../i18n';
import { sceneAssemblyInstructions, splitModelName } from '../../core/assembly/assemblyInstructionsScene';
import { materialLines, stepLines } from '../../core/assembly/assemblyInstructionsText';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { downloadInstructions } from './assemblyInstructionsDownload';

/** Grupo dividido (con uniones guardadas) de la primera pieza seleccionada que pertenezca a uno. */
function selectedGroupId(objects: SceneObject[], selectedIds: string[]): string | null {
  for (const id of selectedIds) {
    const split = objects.find((o) => o.id === id)?.metadata?.split;
    if (split?.joints) return split.groupId;
  }
  return null;
}

export const AssemblyInstructionsPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const setSelection = useKuraStore((s) => s.setSelection);
  const uid = useId();
  const fromSelection = selectedGroupId(objects, selectedIds);
  const [groupId, setGroupId] = useState<string | null>(fromSelection);
  const [active, setActive] = useState<number | null>(null);

  // Otra división elegida en el visor: el panel pasa a esa; sin selección se queda con la que tenía.
  useEffect(() => {
    if (fromSelection && fromSelection !== groupId) {
      setGroupId(fromSelection);
      setActive(null);
    }
  }, [fromSelection, groupId]);

  const parts = useMemo(() => (groupId ? objects.filter((o) => o.metadata?.split?.groupId === groupId) : []), [objects, groupId]);
  const doc = useMemo(() => {
    if (parts.length === 0) return null;
    return { model: splitModelName(parts), instructions: sceneAssemblyInstructions(objects, parts) };
  }, [objects, parts]);

  if (!doc) return <p className="kura-cut-hint" data-testid="asm-instr-empty">{t(language, 'asmInstr.empty')}</p>;
  const { steps, materials } = doc.instructions;

  const pick = (index: number, ids: string[]) => {
    setActive(index);
    setSelection(ids);
  };

  return (
    <div className="kura-asm-instr" data-testid="asm-instr">
      <p className="kura-asm-instr-model" title={doc.model}>{t(language, 'asmInstr.model', { name: doc.model })}</p>
      <small className="kura-cut-hint">{t(language, 'asmInstr.summary', { count: steps.length, joints: materials.joints })}</small>
      <div className="kura-asm-instr-downloads" role="group" aria-label={t(language, 'asmInstr.download.title')}>
        <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'asmInstr.download.mdTip')} onClick={() => void downloadInstructions(language, doc, 'md')}>
          <FileDown size={13} aria-hidden="true" />
          <span>{t(language, 'asmInstr.download.md')}</span>
        </button>
        <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'asmInstr.download.htmlTip')} onClick={() => void downloadInstructions(language, doc, 'html')}>
          <FileDown size={13} aria-hidden="true" />
          <span>{t(language, 'asmInstr.download.html')}</span>
        </button>
      </div>
      <p className="kura-cut-hint" id={`${uid}-hint`}>{t(language, 'asmInstr.highlightHint')}</p>
      <ol className="kura-asm-instr-steps" aria-label={t(language, 'asmInstr.stepsList')} aria-describedby={`${uid}-hint`}>
        {steps.map((step) => {
          const { main, warnings } = stepLines(language, step);
          const textId = `${uid}-s${step.index}`;
          return (
            <li key={step.partId} className="kura-asm-instr-step" data-active={active === step.index || undefined} data-testid={`asm-instr-step-${step.index}`}>
              <button
                type="button"
                className="kura-asm-instr-step-btn"
                aria-current={active === step.index ? 'step' : undefined}
                aria-describedby={textId}
                onFocus={() => pick(step.index, step.partIds)}
                onClick={() => pick(step.index, step.partIds)}
              >
                {t(language, 'asmInstr.stepTitle', { n: step.index, piece: step.code })}
              </button>
              <div id={textId}>
                {main.map((line, i) => <p key={i} className="kura-asm-instr-line">{line}</p>)}
                {warnings.length > 0 && (
                  <ul className="kura-asm-instr-warnings">
                    {warnings.map((w, i) => (
                      <li key={i}>
                        <AlertTriangle size={12} aria-hidden="true" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <h3 className="kura-asm-instr-subtitle">{t(language, 'asmInstr.materials')}</h3>
      <ul className="kura-asm-instr-materials" data-testid="asm-instr-materials">
        {materialLines(language, materials).map((line, i) => <li key={i}>{line}</li>)}
      </ul>
      <small className="kura-cut-hint">{t(language, 'asmInstr.noCaptures')}</small>
    </div>
  );
};
