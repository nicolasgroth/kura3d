/**
 * @file src/components/dialogs/MoldModal.tsx
 * @description Diálogo generador de moldes y contramoldes (velas, silicona, resina).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { PaintBucket } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationFailureAlert, useOperationFailure } from '../OperationFailureAlert';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { OperationPanel } from '../OperationPanel';
import { type MoldMode } from '../../types/kura';

/** Modal 4: Generador Automático de Moldes y Contra-Moldes (Velas, Silicona, Resina). */
export const MoldModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const generateMoldForObject = useKuraStore((s) => s.generateMoldForObject);

  const [mode, setMode] = useState<MoldMode>('silicone_master');
  const [wallMarginMm, setWallMarginMm] = useState(6);
  const [boxWallMm, setBoxWallMm] = useState(3);
  const [splitAxis, setSplitAxis] = useState<'x' | 'z'>('x');
  const [pourSpout, setPourSpout] = useState(true);
  const [pourSpoutRadiusMm, setPourSpoutRadiusMm] = useState(5);
  const [keyToleranceMm, setKeyToleranceMm] = useState(0.25);
  const [cavityWallMm, setCavityWallMm] = useState(3);
  const failure = useOperationFailure(open);

  const targetId = selectedIds[0] ?? objects[0]?.id;

  const handleExecute = async () => {
    if (!targetId) return;
    const { result: created } = await failure.run(() =>
      generateMoldForObject(targetId, {
        mode,
        wallMarginMm,
        boxWallMm,
        splitAxis,
        pourSpout,
        pourSpoutRadiusMm,
        keyToleranceMm,
        cavityWallMm,
      }),
    );
    if (created.length > 0) onClose();
  };

  return (
    <OperationPanel
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.mold.title')}
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!targetId}
            onClick={() => void handleExecute()}
          >
            <PaintBucket size={14} />
            <span>{t(language, 'dialog.mold.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      <div className="kura-form-field">
        <label htmlFor="mold-mode">{t(language, 'dialog.mold.mode')}</label>
        <select
          id="mold-mode"
          className="kura-select"
          value={mode}
          onChange={(e) => setMode(e.target.value as MoldMode)}
        >
          <option value="direct_1part">{t(language, 'dialog.mold.modeDirect1')}</option>
          <option value="direct_2part">{t(language, 'dialog.mold.modeDirect2')}</option>
          <option value="silicone_master">{t(language, 'dialog.mold.modeSilicone')}</option>
          <option value="core_cavity">{t(language, 'dialog.mold.modeCoreCavity')}</option>
        </select>
      </div>

      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="mold-margin">{t(language, 'dialog.mold.wallMargin')}</label>
          <PrecisionNumberInput
            id="mold-margin"
            min={2}
            max={35}
            step={0.5}
            precision={1}
            defaultValue={6}
            value={wallMarginMm}
            onChange={setWallMarginMm}
          />
        </div>

        {mode === 'silicone_master' && (
          <div className="kura-form-field">
            <label htmlFor="mold-boxwall">{t(language, 'dialog.mold.boxWall')}</label>
            <PrecisionNumberInput
              id="mold-boxwall"
              min={1.2}
              max={15}
              step={0.4}
              precision={1}
              defaultValue={3}
              value={boxWallMm}
              onChange={setBoxWallMm}
            />
          </div>
        )}

        {(mode === 'direct_2part' || mode === 'silicone_master') && (
          <>
            <div className="kura-form-field">
              <label htmlFor="mold-split">{t(language, 'dialog.mold.splitAxis')}</label>
              <select
                id="mold-split"
                className="kura-select"
                value={splitAxis}
                onChange={(e) => setSplitAxis(e.target.value as 'x' | 'z')}
              >
                <option value="x">X (Izq / Der)</option>
                <option value="z">Z (Frente / Atrás)</option>
              </select>
            </div>
            <div className="kura-form-field">
              <label htmlFor="mold-tol">{t(language, 'dialog.mold.keyTolerance')}</label>
              <PrecisionNumberInput
                id="mold-tol"
                min={0.05}
                max={1.0}
                step={0.05}
                precision={2}
                defaultValue={0.25}
                value={keyToleranceMm}
                onChange={setKeyToleranceMm}
              />
            </div>
          </>
        )}

        {mode === 'core_cavity' && (
          <div className="kura-form-field">
            <label htmlFor="mold-cavwall">{t(language, 'dialog.mold.cavityWall')}</label>
            <PrecisionNumberInput
              id="mold-cavwall"
              min={1.0}
              max={20}
              step={0.5}
              precision={1}
              defaultValue={3}
              value={cavityWallMm}
              onChange={setCavityWallMm}
            />
          </div>
        )}
      </div>

      <div className="kura-form-grid" style={{ alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={pourSpout}
            onChange={(e) => setPourSpout(e.target.checked)}
          />
          <span>{t(language, 'dialog.mold.pourSpout')}</span>
        </label>

        {pourSpout && (
          <div className="kura-form-field">
            <label htmlFor="mold-spout-r">{t(language, 'dialog.mold.pourSpoutRadius')}</label>
            <PrecisionNumberInput
              id="mold-spout-r"
              min={2}
              max={20}
              step={0.5}
              precision={1}
              defaultValue={5}
              value={pourSpoutRadiusMm}
              onChange={setPourSpoutRadiusMm}
            />
          </div>
        )}
      </div>
    </OperationPanel>
  );
};
