/**
 * @file src/components/settings/McpTokenField.tsx
 * @description Campo del token del puente MCP en Ajustes: enmascarado por defecto con botones
 * mostrar/ocultar y copiar, edición manual validada (≥16 caracteres, sin espacios, con mensaje
 * localizado) antes de aplicarse, regeneración con rotación en el servidor y aviso de dónde se
 * guarda (llavero en escritorio, solo la sesión en web).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';
import { MIN_MCP_TOKEN_LENGTH, maskToken, validateMcpToken } from '../../utils/mcpTokenStore';

interface McpTokenFieldProps {
  language: LanguageCode;
  token: string;
  desktop: boolean;
  rotating: boolean;
  onApply: (token: string) => void;
  onRegenerate: () => void;
}

export function McpTokenField({ language, token, desktop, rotating, onApply, onRegenerate }: McpTokenFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState(token);
  const [copied, setCopied] = useState(false);

  // Un token nuevo (regenerado o hidratado) reemplaza el borrador.
  useEffect(() => setDraft(token), [token]);

  const trimmed = draft.trim();
  const validation = validateMcpToken(trimmed);
  const dirty = trimmed !== token;
  const error = dirty && trimmed.length > 0 && validation !== 'ok'
    ? validation === 'too-short'
      ? t(language, 'dialog.settings.mcpTokenTooShort', { min: MIN_MCP_TOKEN_LENGTH })
      : t(language, 'dialog.settings.mcpTokenInvalidChars')
    : null;

  const apply = () => {
    if (dirty && validation === 'ok') onApply(trimmed);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Portapapeles bloqueado: el usuario puede mostrar el token y copiarlo a mano.
    }
  };

  return (
    <div className="kura-form-field">
      <label htmlFor="mcp-token">{t(language, 'dialog.settings.mcpToken')}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input
          id="mcp-token"
          className="kura-input"
          style={{ flex: 1, minWidth: 160, fontFamily: 'monospace' }}
          type={revealed || !dirty ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          value={revealed || dirty ? draft : maskToken(token)}
          placeholder={maskToken(token)}
          aria-invalid={error ? true : undefined}
          aria-describedby="mcp-token-hint mcp-token-error"
          onFocus={() => {
            if (!revealed && !dirty) setDraft('');
          }}
          onBlur={() => {
            if (!trimmed) setDraft(token);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
            if (e.key === 'Escape') setDraft(token);
          }}
        />
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          aria-pressed={revealed}
          title={t(language, revealed ? 'dialog.settings.mcpTokenHide' : 'dialog.settings.mcpTokenShow')}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          <span className="sr-only">
            {t(language, revealed ? 'dialog.settings.mcpTokenHide' : 'dialog.settings.mcpTokenShow')}
          </span>
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          title={t(language, 'dialog.settings.mcpTokenCopy')}
          onClick={() => void copy()}
          disabled={!token}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span className="sr-only">
            {t(language, copied ? 'dialog.settings.mcpTokenCopied' : 'dialog.settings.mcpTokenCopy')}
          </span>
        </button>
        {dirty && trimmed.length > 0 && (
          <button type="button" className="kura-btn kura-btn-sm" onClick={apply} disabled={validation !== 'ok'}>
            <span>{t(language, 'dialog.settings.mcpTokenApply')}</span>
          </button>
        )}
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          onClick={onRegenerate}
          disabled={rotating}
          title={t(language, 'dialog.settings.mcpRegenerate')}
        >
          <RefreshCw size={13} />
          <span>{t(language, 'dialog.settings.mcpRegenerate')}</span>
        </button>
      </div>
      <span id="mcp-token-error" role="alert" style={{ fontSize: 11, color: 'var(--accent-red)' }}>
        {error ?? ''}
      </span>
      <span id="mcp-token-hint" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        {t(language, 'dialog.settings.mcpAuthRequired')}{' '}
        {t(language, desktop ? 'dialog.settings.mcpTokenStoredDesktop' : 'dialog.settings.mcpTokenStoredWeb')}
      </span>
    </div>
  );
}
