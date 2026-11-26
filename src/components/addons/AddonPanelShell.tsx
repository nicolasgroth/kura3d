/**
 * @file src/components/addons/AddonPanelShell.tsx
 * @description Marco común del panel de un agregado que se coloca con clic (ojo de cerradura, paso de cable): panel
 * de operación no modal en el lugar del inspector, franja plegada con el último aviso, «cómo colocar» (o por qué no
 * se puede), el contenido propio (preajustes y campos) y el resumen de la última colocada: sin avisos o una línea por
 * aviso. Se cierra con «Volver» o Escape. Los textos salen de `<prefijo>.*` y los `data-testid` de `<prefijo>-*`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t, type TranslationKey } from '../../i18n';
import type { AddonWarning } from '../../store/addonWarning';
import { useKuraStore } from '../../store/useKuraStore';
import type { Vec3 } from '../../types/kura';
import { AddonFacePlacer } from './AddonFacePlacer';
import { MagnetFoldStrip } from '../magnet/MagnetFoldStrip';
import { OperationPanel } from '../OperationPanel';
import '../../styles/magnetPanel.css';

export interface AddonPanelShellProps {
  prefix: 'keyhole' | 'cable';
  open: boolean;
  onClose: () => void;
  blocked: boolean;
  /** Avisos de la última colocada (vacío = sin avisos). */
  warnings: readonly AddonWarning[];
  /** Línea «última sin avisos», o null si todavía no se colocó ninguna. */
  lastOk: string | null;
  /** Misma ruta que el clic en el visor: con ella el panel ofrece «Colocar en el centro de la cara» (sin ratón). */
  placeAt?: (hostId: string, point: Vec3, normal: Vec3) => Promise<boolean>;
  children: React.ReactNode;
}

export const AddonPanelShell: React.FC<AddonPanelShellProps> = ({ prefix, open, onClose, blocked, warnings, lastOk, placeAt, children }) => {
  const language = useKuraStore((s) => s.language);
  const k = (s: string) => `${prefix}.${s}` as TranslationKey;
  return (
    <>
      {open && <MagnetFoldStrip prefix={prefix} onDone={onClose} />}
      <OperationPanel
        open={open}
        onClose={onClose}
        title={t(language, k('title'))}
        className={`kura-magnet-panel kura-${prefix}-panel`}
        initialFocus={`[data-testid="${prefix}-preset"]`}
      >
        <p className="kura-magnet-hint" role="status" data-testid={`${prefix}-hint`}>
          {t(language, k(blocked ? 'invalid' : 'hint'))}
        </p>
        {children}
        {placeAt && <AddonFacePlacer testId={prefix} place={placeAt} blocked={blocked} />}
        {lastOk && warnings.length === 0 && (
          <p className="kura-magnet-wall" role="status" data-testid={`${prefix}-last`}>{lastOk}</p>
        )}
        {warnings.map((w) => (
          <p key={w.kind} className="kura-magnet-wall is-warning" role="status" data-testid={`${prefix}-warn-${w.kind}`}>
            {t(language, w.key, w.params)}
          </p>
        ))}
      </OperationPanel>
    </>
  );
};
