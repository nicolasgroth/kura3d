/**
 * @file src/components/NativeModal.tsx
 * @description Envoltorio reutilizable sobre <dialog> nativo con showModal(), `closedby="any"`
 * y respaldo pointerdown/pointerup para navegadores sin `HTMLDialogElement.prototype.closedBy`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { attachDialogDismissHandlers, closeDialogWithMotion } from '../utils/dialogMotion';

export const NativeModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}> = ({ open, onClose, title, children, footer, className }) => {
  const language = useKuraStore((s) => s.language);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      void closeDialogWithMotion(dialog);
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    const detachDismiss = attachDialogDismissHandlers(dialog);

    return () => {
      dialog.removeEventListener('close', handleClose);
      detachDismiss();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={className ? `kura-dialog ${className}` : 'kura-dialog'}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="kura-dialog-header">
        <h2 id={titleId} className="kura-dialog-title">
          {title}
        </h2>
        <button
          type="button"
          className="kura-mini-icon-btn"
          onClick={() => dialogRef.current && void closeDialogWithMotion(dialogRef.current)}
          aria-label={t(language, 'common.close')}
        >
          <X size={16} />
        </button>
      </div>

      <div className="kura-dialog-body">{children}</div>

      {footer && <div className="kura-dialog-footer">{footer}</div>}
    </dialog>
  );
};
