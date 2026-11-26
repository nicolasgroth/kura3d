/**
 * @file src/components/contextPanel/ProjectInfoSection.tsx
 * @description Sección «Datos del proyecto» del panel «Proyecto»: descripción (una línea), notas (área de texto con
 * contador), autor (lo escribe la persona; nunca se rellena solo) y, de solo lectura, creado, modificado y tiempo de
 * trabajo en formato humano. Editar lo hace `setProjectInfo` del store: marca el proyecto como modificado y no es
 * un paso de deshacer (igual que el nombre); el texto se trata siempre como texto plano. Cada campo lleva su etiqueta
 * asociada y su tooltip; se deshabilita mientras se guarda.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import { PROJECT_INFO_LIMITS } from '../../project/projectInfo';
import { useKuraStore } from '../../store/useKuraStore';
import { formatInfoDate, formatWorkSeconds } from '../../utils/projectInfoFormat';
import { PROJECT_NOTES_ID } from '../../utils/projectNotesFocus';
import '../../styles/projectInfo.css';

export const ProjectInfoSection: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const info = useKuraStore((s) => s.projectInfo);
  const workSeconds = useKuraStore((s) => s.projectWorkSeconds);
  const blocked = useKuraStore((s) => s.projectBusy);
  const setProjectInfo = useKuraStore((s) => s.setProjectInfo);
  const titleId = useId();
  const descriptionId = useId();
  const authorId = useId();
  const countId = useId();
  const notes = info.notes ?? '';
  const empty = t(language, 'projectInfo.noDate');

  return (
    <section className="kura-card kura-project-info" aria-labelledby={titleId} data-testid="panel-project-info">
      <h3 id={titleId} className="kura-section-label">{t(language, 'projectInfo.title')}</h3>

      <div className="kura-info-field">
        <label className="kura-field-label" htmlFor={descriptionId}>{t(language, 'projectInfo.description')}</label>
        <input
          id={descriptionId}
          className="kura-input"
          type="text"
          value={info.description ?? ''}
          maxLength={PROJECT_INFO_LIMITS.description}
          disabled={blocked}
          placeholder={t(language, 'projectInfo.descriptionPlaceholder')}
          title={t(language, 'projectInfo.descriptionTip')}
          data-testid="project-info-description"
          onChange={(e) => setProjectInfo({ description: e.target.value })}
        />
      </div>

      <div className="kura-info-field">
        <label className="kura-field-label" htmlFor={PROJECT_NOTES_ID}>{t(language, 'projectInfo.notes')}</label>
        <textarea
          id={PROJECT_NOTES_ID}
          className="kura-textarea kura-info-notes"
          rows={5}
          value={notes}
          maxLength={PROJECT_INFO_LIMITS.notes}
          disabled={blocked}
          placeholder={t(language, 'projectInfo.notesPlaceholder')}
          title={t(language, 'projectInfo.notesTip', { max: PROJECT_INFO_LIMITS.notes })}
          aria-describedby={countId}
          data-testid="project-info-notes"
          onChange={(e) => setProjectInfo({ notes: e.target.value })}
        />
        <span id={countId} className="kura-ctx-sub kura-info-count" data-testid="project-info-notes-count">
          {t(language, 'projectInfo.notesCount', { count: notes.length, max: PROJECT_INFO_LIMITS.notes })}
        </span>
      </div>

      <div className="kura-info-field">
        <label className="kura-field-label" htmlFor={authorId}>{t(language, 'projectInfo.author')}</label>
        <input
          id={authorId}
          className="kura-input"
          type="text"
          value={info.author ?? ''}
          maxLength={PROJECT_INFO_LIMITS.author}
          disabled={blocked}
          placeholder={t(language, 'projectInfo.authorPlaceholder')}
          title={t(language, 'projectInfo.authorTip')}
          autoComplete="off"
          data-testid="project-info-author"
          onChange={(e) => setProjectInfo({ author: e.target.value })}
        />
      </div>

      <dl className="kura-ctx-facts kura-info-facts">
        <dt>{t(language, 'projectInfo.created')}</dt>
        <dd data-testid="project-info-created" title={info.createdAt ?? empty}>
          {info.createdAt ? formatInfoDate(info.createdAt, language) : empty}
        </dd>
        <dt>{t(language, 'projectInfo.modified')}</dt>
        <dd data-testid="project-info-modified" title={info.modifiedAt ?? t(language, 'projectInfo.notSavedYet')}>
          {info.modifiedAt ? formatInfoDate(info.modifiedAt, language) : t(language, 'projectInfo.notSavedYet')}
        </dd>
        <dt title={t(language, 'projectInfo.workTip')}>{t(language, 'projectInfo.work')}</dt>
        <dd data-testid="project-info-work" title={t(language, 'projectInfo.workTip')}>{formatWorkSeconds(workSeconds, language)}</dd>
      </dl>
      <p className="kura-ctx-hint">{t(language, 'projectInfo.hint')}</p>
    </section>
  );
};
