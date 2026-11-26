/**
 * @file src/components/plates/PlateStrip.tsx
 * @description Tira de placas sobre la barra de estado (desde la segunda placa): una ficha por placa con su nombre
 * (doble clic o F2 para renombrarla), número de piezas y estado con icono y texto (bien / fuera de volumen /
 * vacía), la activa marcada con `aria-pressed`; «+» para crear, «Solo esta» para ver solo la cama activa y una
 * acción de borrar la placa activa (con confirmación si tiene piezas: dice a cuál pasan). Las flechas mueven el
 * foco entre fichas; con muchas placas la lista se desplaza en horizontal dentro de la tira.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Eye, LayoutGrid, Plus, Printer, Trash2 } from 'lucide-react';
import { PlateBedPicker } from './PlateBedPicker';
import { otherPlateNameTaken } from '../../core/scene/plates';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { openPlateArrangePanel } from '../../store/plateArrangePanel';
import { askDecision } from '../../utils/confirmDialog';
import '../../styles/plateStrip.css';
import '../../styles/viewMode.css';
import '../../styles/plateBed.css';
import { printPosedObjects } from '../../store/sceneLayout';
import { MIN_PLATES_FOR_STRIP, plateChips, type ChipStatus, type PlateChip } from './plateStripModel';

const STATUS_ICON: Record<ChipStatus, React.ReactNode> = {
  ok: <CheckCircle2 size={12} aria-hidden="true" />,
  out: <AlertTriangle size={12} aria-hidden="true" />,
  empty: <CircleDashed size={12} aria-hidden="true" />,
};

const STATUS_KEY = { ok: 'plates.status.ok', out: 'plates.status.out', empty: 'plates.status.empty' } as const;

/** Nombre editable de una ficha: Enter o salir confirma, Escape cancela. */
const RenameField: React.FC<{ chip: PlateChip; onDone: (name: string | null) => void }> = ({ chip, onDone }) => {
  const language = useKuraStore((s) => s.language);
  const ref = useRef<HTMLInputElement | null>(null);
  const finished = useRef(false);
  const [taken, setTaken] = useState<string | null>(null);
  const errorId = useId();
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (value: string | null, fromBlur = false) => {
    if (finished.current) return;
    if (value !== null) {
      // Un nombre que ya usa otra placa no se acepta: se avisa junto al campo y se conserva lo escrito.
      const clash = otherPlateNameTaken(useKuraStore.getState().plates, chip.id, value);
      if (clash) {
        setTaken(value.trim());
        if (!fromBlur) ref.current?.focus();
        return;
      }
    }
    finished.current = true;
    onDone(value);
  };
  return (
    <span className="kura-plate-rename-wrap">
      <input
        ref={ref}
        className="kura-plate-rename"
        defaultValue={chip.name}
        maxLength={80}
        aria-label={t(language, 'plates.rename.label')}
        aria-invalid={taken ? true : undefined}
        aria-describedby={taken ? errorId : undefined}
        onChange={() => taken && setTaken(null)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') finish(e.currentTarget.value);
          else if (e.key === 'Escape') finish(null);
        }}
        onBlur={(e) => finish(e.currentTarget.value, true)}
      />
      {taken && (
        <span id={errorId} className="kura-plate-rename-error" role="alert">
          <AlertTriangle size={12} aria-hidden="true" />
          {t(language, 'plates.rename.taken', { name: taken })}
        </span>
      )}
    </span>
  );
};

export const PlateStrip: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const plates = useKuraStore((s) => s.plates);
  const activePlateId = useKuraStore((s) => s.activePlateId);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const plateSolo = useKuraStore((s) => s.plateSolo);
  const busy = useKuraStore((s) => s.busyOperation !== null);
  const layout = useKuraStore((s) => s.layout);
  const armed = layout === 'assembly';
  const [renaming, setRenaming] = useState<string | null>(null);
  const [bedFor, setBedFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const chips = useMemo(
    () => plateChips(armed ? printPosedObjects(useKuraStore.getState()) : objects, printerProfile, plates, activePlateId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [objects, printerProfile, plates, activePlateId, armed],
  );
  const active = chips.find((c) => c.active) ?? chips[0];

  // La ficha activa siempre queda a la vista (con muchas placas la lista se desplaza).
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [active?.id, chips.length]);

  if (plates.length < MIN_PLATES_FOR_STRIP || !active) return null;

  const store = () => useKuraStore.getState();

  const moveFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button.kura-plate-chip-main') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const commitRename = (id: string, value: string | null) => {
    setRenaming(null);
    if (value !== null) store().renamePlate(id, value);
    // El foco vuelve a la ficha (el campo desapareció).
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>(`[data-plate-id="${CSS.escape(id)}"] button.kura-plate-chip-main`)?.focus());
  };

  const removeActive = async () => {
    const { plates: now, objects: all } = store();
    const target = now.find((p) => p.id !== active.id);
    if (!target) return;
    const count = all.filter((o) => o.plateRef === active.id).length;
    if (count > 0) {
      const decision = await askDecision({
        title: t(language, 'plates.delete.title'),
        message: t(language, 'plates.delete.message', { name: active.name, count, target: target.name }),
        safeId: 'cancel',
        actions: [
          { id: 'delete', label: t(language, 'plates.delete.confirm'), tone: 'danger' },
          { id: 'cancel', label: t(language, 'dialog.cancel') },
        ],
      });
      if (decision !== 'delete') return;
    }
    const to = store().removePlate(active.id);
    if (to) {
      const targetName = store().plates.find((p) => p.id === to)?.name ?? target.name;
      store().addToast(t(language, 'plates.toast.removed', { name: active.name, target: targetName }), 'info');
    }
  };

  return (
    <section className="kura-plate-strip" aria-label={t(language, 'plates.strip.label')} data-testid="plate-strip" data-view-mode={armed ? 'armed' : 'print'}>
      <div className="kura-plate-list" ref={listRef} onKeyDown={moveFocus}>
        {chips.map((chip) => {
          const pieces = t(language, 'plates.chip.pieces', { count: chip.count });
          const status = t(language, STATUS_KEY[chip.status]);
          return (
            <div key={chip.id} className="kura-plate-chip" data-plate-id={chip.id} data-active={chip.active} data-status={chip.status}>
              {renaming === chip.id ? (
                <RenameField chip={chip} onDone={(value) => commitRename(chip.id, value)} />
              ) : (
                <button
                  type="button"
                  className="kura-plate-chip-main"
                  aria-pressed={chip.active}
                  aria-label={chip.bedName
                    ? t(language, 'plates.bed.chipLabel', { name: chip.name, pieces, status, bed: chip.bedName })
                    : t(language, 'plates.chip.label', { name: chip.name, pieces, status })}
                  aria-keyshortcuts="F2"
                  title={t(language, 'plates.chip.tip', { name: chip.name })}
                  onClick={() => store().setActivePlate(chip.id)}
                  onDoubleClick={() => !busy && setRenaming(chip.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'F2' && !busy) {
                      e.preventDefault();
                      e.stopPropagation();
                      store().setActivePlate(chip.id);
                      setRenaming(chip.id);
                    }
                  }}
                >
                  <span className="kura-plate-chip-name">{chip.name}</span>
                  <span className="kura-plate-chip-count">{pieces}</span>
                  <span className="kura-plate-chip-status" data-status={chip.status}>
                    {STATUS_ICON[chip.status]}
                    <span>{status}</span>
                  </span>
                  {chip.bedName && <span className="kura-plate-chip-bed" data-testid="plate-chip-bed">{t(language, 'plates.bed.chip', { bed: chip.bedName })}</span>}
                </button>
              )}
              <button
                type="button"
                className="kura-plate-chip-bed-btn"
                onClick={() => setBedFor(chip.id)}
                disabled={busy}
                aria-label={t(language, 'plates.bed.action', { name: chip.name })}
                title={t(language, 'plates.bed.actionTip')}
                aria-haspopup="dialog"
                data-testid="plate-bed-open"
              >
                <Printer size={12} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      {armed && <span className="kura-plate-strip-note" data-testid="plate-strip-note">{t(language, 'viewMode.strip.note')}</span>}
      <div className="kura-plate-actions">
        <button
          type="button"
          className="kura-plate-btn"
          onClick={() => store().createPlate()}
          disabled={busy || armed}
          aria-label={t(language, 'plates.add')}
          title={t(language, 'plates.add.tip')}
          data-testid="plate-add"
        >
          <Plus size={13} aria-hidden="true" />
        </button>
        {/* «Una placa por objeto» pasó a ser una opción del panel: un solo botón evita dos entradas que confunden.
            Sin aria-label: el nombre accesible es el texto visible «Repartir…» (WCAG 2.5.3). Con «Repartir en
            placas…» como nombre no se encontraba por lo que se ve (QA 25-h). */}
        <button
          type="button"
          className="kura-plate-btn kura-plate-btn-text"
          onClick={() => openPlateArrangePanel()}
          disabled={busy}
          title={t(language, 'plates.arrangeDlg.entryTip')}
          data-testid="plate-arrange"
        >
          <LayoutGrid size={13} aria-hidden="true" />
          <span>{t(language, 'plates.arrangeDlg.strip')}</span>
        </button>
        <button
          type="button"
          className="kura-plate-btn kura-plate-btn-text"
          aria-pressed={plateSolo}
          onClick={() => store().setPlateSolo(!plateSolo)}
          title={t(language, 'plates.solo.tip')}
          data-testid="plate-solo"
        >
          <Eye size={13} aria-hidden="true" />
          <span>{t(language, 'plates.solo')}</span>
        </button>
        <button
          type="button"
          className="kura-plate-btn"
          onClick={() => void removeActive()}
          disabled={busy || armed}
          aria-label={t(language, 'plates.delete', { name: active.name })}
          title={t(language, 'plates.delete', { name: active.name })}
          data-testid="plate-delete"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      {bedFor && (
        <PlateBedPicker
          plateId={bedFor}
          onClose={() => {
            const id = bedFor;
            setBedFor(null);
            // El foco vuelve al botón que abrió el selector.
            requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>(`[data-plate-id="${CSS.escape(id)}"] .kura-plate-chip-bed-btn`)?.focus());
          }}
        />
      )}
    </section>
  );
};
