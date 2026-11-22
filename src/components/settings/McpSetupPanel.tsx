/**
 * @file src/components/settings/McpSetupPanel.tsx
 * @description Bloque de configuración del cliente MCP en Ajustes: JSON copiable con ruta absoluta del servidor
 * (o marcador `<RUTA_AL_REPOSITORIO>` con nota), ayuda paso a paso cuando el estado es "Esperando servidor" y
 * botón "Probar conexión" que distingue servidor apagado, token rechazado y conectado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { useMcpBridgeStatus } from '../../utils/mcpBridgeClient';
import { probeBridgeServer } from '../../utils/mcpBridgeHealth';
import {
  buildClaudeAddCommand,
  buildMcpSnippet,
  MCP_BUILD_COMMAND,
  MCP_REPO_PATH_KEY,
  normalizeRepoPath,
} from '../../utils/mcpConfigSnippet';
import { maskToken } from '../../utils/mcpTokenStore';

function readSavedRepoPath(): string {
  try {
    return normalizeRepoPath(localStorage.getItem(MCP_REPO_PATH_KEY) ?? '');
  } catch {
    return '';
  }
}

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Portapapeles bloqueado: el texto sigue visible para copiarlo a mano.
    }
  };
  return (
    <button type="button" className="kura-btn kura-btn-sm" title={label} onClick={() => void copy()}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

const CODE_STYLE = {
  margin: 0,
  padding: 10,
  borderRadius: 8,
  background: 'var(--bg-canvas)',
  border: '1px solid var(--border-subtle)',
  fontSize: 11,
  overflowX: 'auto',
} as const;

export function McpSetupPanel() {
  const language = useKuraStore((state) => state.language);
  const config = useKuraStore((state) => state.mcpConfig);
  const connected = useKuraStore((state) => state.mcpConnected);
  const phase = useMcpBridgeStatus((state) => state.phase);
  const [repoPath, setRepoPath] = useState(readSavedRepoPath);
  const [testText, setTestText] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  // Un resultado de "Probar conexión" deja de valer cuando cambia el estado del puente.
  useEffect(() => {
    setTestText(null);
  }, [config.enabled, config.port, config.requireAuth, phase, connected]);

  const updatePath = (value: string) => {
    setRepoPath(value);
    try {
      const clean = normalizeRepoPath(value);
      if (clean) localStorage.setItem(MCP_REPO_PATH_KEY, clean);
      else localStorage.removeItem(MCP_REPO_PATH_KEY);
    } catch {
      // Sin almacenamiento: la ruta vale solo para esta sesión.
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestText(null);
    try {
      if (!config.enabled) {
        setTestText({ ok: false, text: t(language, 'mcp.setup.test.disabled') });
      } else if (connected) {
        setTestText({ ok: true, text: t(language, 'mcp.setup.test.connected') });
      } else {
        const listening = await probeBridgeServer(config.port);
        setTestText({
          ok: false,
          text: t(language, listening ? 'mcp.setup.test.rejected' : 'mcp.setup.test.noServer', { port: config.port }),
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const snippet = buildMcpSnippet(config, repoPath);
  const shown = config.authToken ? buildMcpSnippet(config, repoPath, maskToken(config.authToken)) : snippet;
  const addCommand = buildClaudeAddCommand(config, repoPath);
  const showHelp = config.enabled && phase === 'waiting';
  const copyLabel = t(language, 'dialog.settings.mcpCopy');
  const copiedLabel = t(language, 'dialog.settings.mcpCopied');

  return (
    <>
      <div className="kura-form-field">
        <label htmlFor="mcp-repo-path">{t(language, 'mcp.setup.pathLabel')}</label>
        <input
          id="mcp-repo-path"
          className="kura-input"
          style={{ fontFamily: 'monospace' }}
          spellCheck={false}
          autoComplete="off"
          value={repoPath}
          aria-describedby="mcp-repo-path-note"
          placeholder={t(language, 'mcp.setup.pathPlaceholder')}
          onChange={(event) => updatePath(event.target.value)}
        />
        {!normalizeRepoPath(repoPath) && (
          <small id="mcp-repo-path-note" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t(language, 'mcp.setup.pathNote')}
          </small>
        )}
      </div>

      {/* Probar conexión y su resultado van juntos, antes del bloque de configuración (no bajo el pliegue). */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={testing}
          title={t(language, 'dialog.settings.testConnection')}
          aria-describedby="mcp-test-result"
          onClick={() => void runTest()}
        >
          {t(language, 'dialog.settings.testConnection')}
        </button>
        <div id="mcp-test-result" role="status" aria-live="polite" style={{ flex: '1 1 200px', minHeight: 18 }}>
          {testText && (
            <span className={`kura-callout ${testText.ok ? 'is-local' : 'is-warning'}`} style={{ display: 'flex', fontWeight: 600 }}>
              {testText.ok ? '✓ ' : '✕ '}{testText.text}
            </span>
          )}
        </div>
      </div>

      <pre style={CODE_STYLE} tabIndex={0}>{shown}</pre>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <CopyButton text={snippet} label={copyLabel} copiedLabel={copiedLabel} />
      </div>

      {showHelp && (
        <section className="kura-card" style={{ gap: 8 }} aria-label={t(language, 'mcp.setup.helpTitle')}>
          <strong style={{ fontSize: 12.5 }}>{t(language, 'mcp.setup.helpTitle')}</strong>
          <span style={{ fontSize: 12 }}>{t(language, 'mcp.setup.step1')}</span>
          <pre style={CODE_STYLE} tabIndex={0}>{MCP_BUILD_COMMAND}</pre>
          <CopyButton text={MCP_BUILD_COMMAND} label={t(language, 'mcp.setup.copyCommand')} copiedLabel={copiedLabel} />
          <span style={{ fontSize: 12 }}>{t(language, 'mcp.setup.step2')}</span>
          <pre style={CODE_STYLE} tabIndex={0}>{addCommand}</pre>
          <CopyButton text={addCommand} label={t(language, 'mcp.setup.copyCommand')} copiedLabel={copiedLabel} />
          <span style={{ fontSize: 12 }}>{t(language, 'mcp.setup.step3')}</span>
        </section>
      )}
    </>
  );
}
