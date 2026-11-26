/**
 * @file src/components/inspector/GroupTransformCard.tsx
 * @description Tarjeta del inspector para un grupo o una selección múltiple: nombre del grupo (editable),
 * número de objetos, Agrupar/Desagrupar/Combinar, y mover (X, Y, Z del usuario), girar en Z y escalar
 * en proporción todo el conjunto como cuerpo rígido. Cada «Aplicar» es un paso de deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId, useState } from 'react';
import { Boxes, Group, Ungroup } from 'lucide-react';
import { t } from '../../i18n';
import { selectedGroup } from '../../core/scene/groups';
import { fromUserRotation, fromUserVector } from '../../core/scene/displayAxes';
import { useKuraStore } from '../../store/useKuraStore';
import type { Vec3 } from '../../types/kura';
import { tCount } from '../../utils/plural';
import '../../styles/sceneTree.css';

const num = (v: string) => (Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : 0);

export const GroupTransformCard: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const groups = useKuraStore((s) => s.groups);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const transformSelectionRigid = useKuraStore((s) => s.transformSelectionRigid);
  const renameGroup = useKuraStore((s) => s.renameGroup);
  const groupObjects = useKuraStore((s) => s.groupObjects);
  const ungroupObjects = useKuraStore((s) => s.ungroupObjects);
  const combineObjects = useKuraStore((s) => s.combineObjects);
  const group = selectedGroup(objects, groups, selectedIds);
  const id = useId();
  const [move, setMove] = useState(['0', '0', '0']);
  const [angle, setAngle] = useState('90');
  const [percent, setPercent] = useState('100');
  const locked = objects.some((o) => selectedIds.includes(o.id) && o.locked);

  const applyMove = () => {
    const user: Vec3 = [num(move[0]), num(move[1]), num(move[2])];
    if (transformSelectionRigid({ translate: fromUserVector(user) }, { recordHistory: true })) setMove(['0', '0', '0']);
  };
  const applyRotate = () => transformSelectionRigid({ rotation: fromUserRotation([0, 0, (num(angle) * Math.PI) / 180]) }, { recordHistory: true });
  const applyScale = () => {
    const f = num(percent) / 100;
    if (f > 0 && transformSelectionRigid({ scale: f }, { recordHistory: true })) setPercent('100');
  };

  return (
    <div className="kura-card kura-group-card">
      <h3 className="kura-section-label">{t(language, 'groups.inspector.title')}</h3>
      {group && (
        <label className="kura-group-card-name">
          <span>{t(language, 'groups.tree.renameGroup')}</span>
          <input
            key={group.id + group.name}
            className="kura-input"
            defaultValue={group.name}
            maxLength={80}
            onBlur={(e) => renameGroup(group.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      )}
      <p className="kura-group-card-desc">
        {tCount(language, { one: 'groups.tree.members.one', other: 'groups.tree.members.other' }, selectedIds.length)}
        {' · '}
        {t(language, 'groups.inspector.desc')}
      </p>
      <div className="kura-group-card-actions">
        {!group && (
          <button type="button" className="kura-btn kura-btn-sm" title={t(language, locked ? 'groups.toast.locked' : 'groups.action.group.tip')} aria-keyshortcuts="Control+G Meta+G" disabled={locked} onClick={() => groupObjects()}>
            <Group size={13} aria-hidden="true" />
            <span>{t(language, 'groups.action.group')}</span>
          </button>
        )}
        {group && (
          <button type="button" className="kura-btn kura-btn-sm" title={t(language, locked ? 'groups.toast.lockedUngroup' : 'groups.action.ungroup.tip')} aria-keyshortcuts="Control+Shift+G Meta+Shift+G" disabled={locked} onClick={() => ungroupObjects(group.id)}>
            <Ungroup size={13} aria-hidden="true" />
            <span>{t(language, 'groups.action.ungroup')}</span>
          </button>
        )}
        <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'groups.action.combine.tip')} disabled={locked} onClick={() => combineObjects()}>
          <Boxes size={13} aria-hidden="true" />
          <span>{t(language, 'groups.action.combine')}</span>
        </button>
      </div>

      <fieldset className="kura-group-card-row" disabled={locked}>
        <legend>{t(language, 'groups.inspector.move')}</legend>
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <label key={axis} className="kura-group-card-field">
            <span aria-hidden="true">{axis}</span>
            <input
              className="kura-input"
              inputMode="decimal"
              aria-label={`${t(language, 'groups.inspector.move')} ${axis}`}
              value={move[i]}
              onChange={(e) => setMove(move.map((m, j) => (j === i ? e.target.value : m)))}
              onKeyDown={(e) => e.key === 'Enter' && applyMove()}
            />
          </label>
        ))}
        <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'groups.inspector.applyMove')} onClick={applyMove}>
          {t(language, 'groups.inspector.apply')}
        </button>
      </fieldset>

      <fieldset className="kura-group-card-row" disabled={locked}>
        <legend id={`${id}-rot`}>{t(language, 'groups.inspector.rotate')}</legend>
        <input className="kura-input" inputMode="decimal" aria-labelledby={`${id}-rot`} value={angle} onChange={(e) => setAngle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyRotate()} />
        <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'groups.inspector.applyRotate')} onClick={applyRotate}>
          {t(language, 'groups.inspector.apply')}
        </button>
      </fieldset>

      <fieldset className="kura-group-card-row" disabled={locked}>
        <legend id={`${id}-sc`}>{t(language, 'groups.inspector.scale')}</legend>
        <input className="kura-input" inputMode="decimal" aria-labelledby={`${id}-sc`} value={percent} onChange={(e) => setPercent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyScale()} />
        <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'groups.inspector.applyScale')} onClick={applyScale}>
          {t(language, 'groups.inspector.apply')}
        </button>
      </fieldset>
    </div>
  );
};
