/**
 * @file src/components/ProjectRecoveryBanner.tsx
 * @description Aviso accesible de borradores de recuperación local con acciones de restaurar y descartar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useId, useState } from 'react';
import { History } from 'lucide-react';
import { t } from '../i18n';
import { recoveryDraftLabel, recoveryDraftTime } from '../project/projectRecoveryLabels';
import type { RecoveryDraftInfo } from '../project/projectRecoveryStorage';
import { useKuraStore } from '../store/useKuraStore';
import '../styles/projectRecovery.css';

interface ProjectRecoveryBannerProps {
  drafts: readonly RecoveryDraftInfo[];
  busy: boolean;
  onRestore: (draft: RecoveryDraftInfo) => void;
  onDiscard: (draft: RecoveryDraftInfo) => void;
}

export function ProjectRecoveryBanner({ drafts, busy, onRestore, onDiscard }: ProjectRecoveryBannerProps) {
  const language = useKuraStore((state) => state.language);
  const headingId = useId();
  const bodyId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const draft = drafts.find((candidate) => candidate.id === selectedId) ?? drafts[0];
  if (!draft) return null;

  const draftName = draft.name ?? t(language, 'app.untitled');

  return (
    <section className="kura-recovery-banner" aria-labelledby={headingId}>
      <div className="kura-recovery-heading">
        <h2 id={headingId}>
          <History size={16} aria-hidden="true" />
          {t(language, 'recovery.banner.title')}
        </h2>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          aria-controls={bodyId}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((previous) => !previous)}
        >
          {t(language, collapsed ? 'recovery.banner.show' : 'recovery.banner.later')}
        </button>
      </div>

      <div className="kura-recovery-body" id={bodyId} hidden={collapsed} aria-busy={busy}>
        <div className="kura-recovery-details">
          {drafts.length > 1 ? (
            <select
              className="kura-select kura-recovery-picker"
              aria-label={t(language, 'recovery.banner.choose')}
              title={recoveryDraftLabel(draft, language)}
              value={draft.id}
              disabled={busy}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {drafts.map((option) => (
                <option key={option.id} value={option.id}>
                  {recoveryDraftLabel(option, language)}
                </option>
              ))}
            </select>
          ) : (
            <strong title={draftName}>{draftName}</strong>
          )}
          <time dateTime={new Date(draft.updatedAt).toISOString()}>{recoveryDraftTime(draft, language)}</time>
        </div>

        <div className="kura-recovery-actions">
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-btn-primary"
            disabled={busy}
            onClick={() => onRestore(draft)}
          >
            {t(language, 'recovery.banner.restore')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={busy}
            onClick={() => onDiscard(draft)}
          >
            {t(language, 'recovery.banner.discard')}
          </button>
        </div>
      </div>
    </section>
  );
}
