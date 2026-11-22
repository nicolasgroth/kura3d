/**
 * @file src/components/settings/AiSettingsPanel.tsx
 * @description Pestaña "Proveedor IA" de Ajustes: proveedor nativo o compatible con OpenAI (presets
 * DeepSeek, Qwen, OpenRouter, LM Studio, Ollama, personalizado), clave por ranura (en escritorio solo se
 * sabe si existe: el valor queda en el llavero), modelo, URL base, temperatura y lista de servidores
 * permitidos que el usuario edita explícitamente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { Cloud, ShieldCheck } from 'lucide-react';
import { askDecision } from '../../utils/confirmDialog';
import { testAiConnection } from '../../utils/aiConnectionTest';
import { modelSuggestions } from '../../utils/aiModelSuggestions';
import { getApiKeyStore } from '../../ai/apiKeyStore';
import { loadKeyState } from '../../ai/aiConfigState';
import { getAllowedHostsSync, loadAllowedHosts, parseHostList, saveAllowedHosts } from '../../ai/allowedHosts';
import { COMPAT_PRESET_IDS, COMPAT_PRESETS, PROVIDERS, specFor } from '../../ai/providerCatalog';
import { DEFAULT_ALLOWED_HOSTS, isAllowedProviderUrl, isLoopbackUrl } from '../../ai/providerSecurity';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { AiCompatPresetId, AiConfig, AiProviderType } from '../../types/kura';

type Draft = Pick<AiConfig, 'provider' | 'compatPreset' | 'model' | 'baseUrl' | 'temperature'>;

/** Sin clave para un proveedor que la exige, el asistente determinista local atiende el chat. */
function isLocalConfig(config: AiConfig): boolean {
  return specFor(config).needsKey && !config.apiKey.trim() && !config.keyStored;
}

interface TestOutcome {
  busy: boolean;
  text: string;
  ok: boolean;
}

export const AiSettingsPanel: React.FC<{ open: boolean; onSaved: () => void }> = ({ open, onSaved }) => {
  const language = useKuraStore((s) => s.language);
  const aiConfig = useKuraStore((s) => s.aiConfig);
  const setAiConfig = useKuraStore((s) => s.setAiConfig);
  const addToast = useKuraStore((s) => s.addToast);
  const keyStore = getApiKeyStore();

  const [draft, setDraft] = useState<Draft>(aiConfig);
  // `null` = no se tocó la clave (se conserva la guardada); '' con `clearKey` = borrar.
  const [keyInput, setKeyInput] = useState('');
  const [keyStored, setKeyStored] = useState(Boolean(aiConfig.keyStored || aiConfig.apiKey));
  const [clearKey, setClearKey] = useState(false);
  const [rememberKey, setRememberKey] = useState(() => keyStore.rememberInSession());
  const [urlError, setUrlError] = useState<string | null>(null);
  const [hostsText, setHostsText] = useState(() => getAllowedHostsSync().join('\n'));
  const [localMode, setLocalMode] = useState(() => isLocalConfig(aiConfig));
  const [test, setTest] = useState<TestOutcome | null>(null);
  const openSettings = useKuraStore((s) => s.openSettings);
  const testAbort = useRef<AbortController | null>(null);
  const resumeRef = useRef(false);
  const skipCloseCheck = useRef(false);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (!open) return;
    if (resumeRef.current) {
      // Volver a editar tras cancelar el aviso: se conserva el borrador.
      resumeRef.current = false;
      return;
    }
    setLocalMode(isLocalConfig(aiConfig));
    setTest(null);
    setDraft(aiConfig);
    setUrlError(null);
    setKeyInput(keyStore.desktop ? '' : aiConfig.apiKey);
    setKeyStored(Boolean(aiConfig.keyStored || aiConfig.apiKey));
    setClearKey(false);
    setRememberKey(keyStore.rememberInSession());
    void loadAllowedHosts().then((hosts) => setHostsText(hosts.join('\n')), () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const spec = specFor(draft);
  const isCompat = draft.provider === 'openai_compatible';

  /** Cada ranura tiene su clave: al cambiar de proveedor o preset se consulta la suya, nunca se reenvía otra. */
  const switchTo = (next: Draft) => {
    const nextSpec = specFor(next);
    setDraft({ ...next, model: nextSpec.defaultModel, baseUrl: '' });
    setLocalMode(false);
    setTest(null);
    setUrlError(null);
    setKeyInput('');
    setClearKey(false);
    setKeyStored(false);
    void loadKeyState({ ...aiConfig, ...next, apiKey: '' }, keyStore).then((state) => {
      setKeyStored(Boolean(state.keyStored || state.apiKey));
      if (!keyStore.desktop) setKeyInput(state.apiKey);
    });
  };

  const handleSave = async (): Promise<boolean> => {
    // La URL base se valida primero: un error se muestra junto al campo y no se guarda nada.
    const typedUrl = draft.baseUrl.trim();
    if (typedUrl) {
      let parsedOk = false;
      try {
        const parsed = new URL(typedUrl);
        parsedOk = parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        parsedOk = false;
      }
      if (!parsedOk) {
        setUrlError(t(language, 'dialog.settings.baseUrlInvalid'));
        document.getElementById('ai-url')?.focus();
        return false;
      }
    }
    setUrlError(null);
    const { hosts, invalid } = parseHostList(hostsText.split(/\r?\n/));
    if (invalid.length) {
      addToast(t(language, 'dialog.settings.allowedHostsInvalid', { list: invalid.join(', ') }), 'error');
      return false;
    }
    let allowed = hosts;
    if (hosts.join('\n') !== getAllowedHostsSync().join('\n')) {
      try {
        allowed = await saveAllowedHosts(hosts);
      } catch {
        addToast(t(language, 'dialog.settings.allowedHostsCancelled'), 'info');
        return false;
      }
    }
    const url = (draft.baseUrl.trim() || spec.defaultBaseUrl).replace(/\/+$/, '');
    if (!localMode && url && !isAllowedProviderUrl(url, allowed)) {
      let host = url;
      try {
        host = new URL(url).hostname;
      } catch {
        // URL inválida: se muestra tal cual.
      }
      setUrlError(
        isLoopbackUrl(url) || !/^https:/i.test(url)
          ? t(language, 'ai.error.endpointBlocked')
          : t(language, 'dialog.settings.hostNotInList', { host }),
      );
      document.getElementById('ai-url')?.focus();
      return false;
    }
    keyStore.setRememberInSession(rememberKey);
    const typedKey = keyInput.trim();
    // Modo local: se guarda sin clave, de modo que el chat usa el asistente determinista del equipo.
    const dropKey = clearKey || localMode;
    const keyChanged = dropKey || (keyStore.desktop ? typedKey.length > 0 : typedKey !== aiConfig.apiKey);
    if (keyChanged) setAiConfig({ ...draft, apiKey: dropKey ? '' : typedKey });
    // Sin clave nueva: en escritorio se conserva la del llavero de la ranura elegida (solo su existencia).
    else setAiConfig({ ...draft, ...(keyStore.desktop ? { keyStored } : {}) });
    addToast(t(language, 'toast.settingsSaved'), 'success');
    skipCloseCheck.current = true;
    onSaved();
    return true;
  };

  const external = !localMode && !isLoopbackUrl(draft.baseUrl.trim() || spec.defaultBaseUrl)
    && (keyStored || keyInput.trim().length > 0);

  const hasPendingChanges = (
    draft.provider !== aiConfig.provider
    || (draft.provider === 'openai_compatible' && (draft.compatPreset ?? 'custom') !== (aiConfig.compatPreset ?? 'custom'))
    || draft.model.trim() !== aiConfig.model.trim()
    || draft.baseUrl.trim() !== aiConfig.baseUrl.trim()
    || draft.temperature !== aiConfig.temperature
    || clearKey
    || (keyStore.desktop ? keyInput.trim().length > 0 : keyInput.trim() !== aiConfig.apiKey.trim())
    || localMode !== isLocalConfig(aiConfig)
    || hostsText.trim() !== getAllowedHostsSync().join('\n').trim()
  );
  const pendingRef = useRef(false);
  pendingRef.current = hasPendingChanges;

  // Cerrar Ajustes con cambios sin guardar no los descarta en silencio: se pregunta.
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    if (skipCloseCheck.current) {
      skipCloseCheck.current = false;
      return;
    }
    if (!pendingRef.current) return;
    void (async () => {
      const decision = await askDecision({
        title: t(language, 'unsaved.title'),
        message: t(language, 'dialog.settings.aiUnsavedMessage'),
        safeId: 'cancel',
        actions: [
          { id: 'save', label: t(language, 'unsaved.save'), tone: 'primary' },
          { id: 'discard', label: t(language, 'unsaved.discard'), tone: 'danger' },
          { id: 'cancel', label: t(language, 'unsaved.cancel') },
        ],
      });
      if (decision === 'discard') return;
      if (decision === 'save' && (await saveRef.current())) return;
      // Cancelar (o un guardado con errores) vuelve a Ajustes con el borrador intacto.
      resumeRef.current = true;
      openSettings('ai');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runConnectionTest = async () => {
    if (localMode) {
      setTest({ busy: false, ok: true, text: t(language, 'dialog.settings.test.local') });
      return;
    }
    const typed = keyInput.trim();
    if (keyStore.desktop && typed && !keyStored) {
      setTest({ busy: false, ok: false, text: t(language, 'dialog.settings.test.desktopKey') });
      return;
    }
    testAbort.current?.abort();
    const controller = new AbortController();
    testAbort.current = controller;
    setTest({ busy: true, ok: false, text: t(language, 'dialog.settings.testing') });
    const result = await testAiConnection({
      config: draft,
      typedKey: keyStore.desktop ? '' : typed,
      keyStored: keyStored && !clearKey,
      allowedHosts: getAllowedHostsSync(),
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    const provider = spec.label;
    const text = (() => {
      switch (result.kind) {
        case 'ok': return t(language, 'dialog.settings.test.ok', { provider });
        case 'auth': return t(language, 'dialog.settings.test.auth', { provider, status: result.status });
        case 'http': return t(language, 'dialog.settings.test.http', { provider, status: result.status });
        case 'timeout': return t(language, 'dialog.settings.test.timeout');
        case 'noKey': return t(language, 'dialog.settings.test.noKey');
        case 'url': return t(language, 'dialog.settings.test.url');
        case 'blocked': return t(language, 'ai.error.endpointBlocked');
        default: return t(language, 'dialog.settings.test.network');
      }
    })();
    setTest({ busy: false, ok: result.kind === 'ok', text });
  };

  useEffect(() => () => testAbort.current?.abort(), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="kura-form-field">
        <label htmlFor="ai-provider">{t(language, 'dialog.settings.aiProvider')}</label>
        <select
          id="ai-provider"
          className="kura-select"
          value={localMode ? 'local' : draft.provider}
          onChange={(e) => {
            if (e.target.value === 'local') {
              switchTo({ ...draft, provider: 'gemini', compatPreset: undefined });
              setLocalMode(true);
              return;
            }
            switchTo({ ...draft, provider: e.target.value as AiProviderType });
          }}
        >
          <option value="local">{t(language, 'dialog.settings.providerLocal')}</option>
          <option value="gemini">{PROVIDERS.gemini.label}</option>
          <option value="openai">{PROVIDERS.openai.label}</option>
          <option value="anthropic">{PROVIDERS.anthropic.label}</option>
          <option value="ollama">Ollama (Local)</option>
          <option value="openai_compatible">{t(language, 'dialog.settings.providerCompat')}</option>
        </select>
      </div>

      {localMode && (
        <div className="kura-callout is-local" role="note">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>
            {t(language, 'dialog.settings.providerLocalNote')}
            {/* Solo si hay una clave guardada que el cambio a modo local vaya a quitar. */}
            {keyStored && ` ${t(language, 'dialog.settings.providerLocalKeyNote')}`}
          </span>
        </div>
      )}

      {isCompat && !localMode && (
        <div className="kura-form-field">
          <label htmlFor="ai-preset">{t(language, 'dialog.settings.aiCompatPreset')}</label>
          <select
            id="ai-preset"
            className="kura-select"
            value={draft.compatPreset ?? 'custom'}
            onChange={(e) => switchTo({ ...draft, compatPreset: e.target.value as AiCompatPresetId })}
          >
            {COMPAT_PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {id === 'custom' ? t(language, 'dialog.settings.presetCustom') : COMPAT_PRESETS[id].label}
              </option>
            ))}
          </select>
        </div>
      )}

      {draft.provider !== 'ollama' && !localMode && (
        <div className="kura-form-field">
          <label htmlFor="ai-key">
            {spec.needsKey ? t(language, 'dialog.settings.apiKey') : t(language, 'dialog.settings.apiKeyOptional')}
          </label>
          <input
            id="ai-key"
            type="password"
            className="kura-input"
            placeholder={keyStored && keyStore.desktop ? '••••••••' : t(language, 'dialog.settings.apiKeyPlaceholder')}
            value={keyInput}
            autoComplete="off"
            aria-describedby="ai-key-storage"
            onChange={(e) => {
              setKeyInput(e.target.value);
              setClearKey(false);
            }}
          />
          <small id="ai-key-storage" style={{ fontSize: 11, opacity: 0.85 }}>
            {keyStore.desktop && keyStored && !clearKey ? `${t(language, 'dialog.settings.apiKeyStored')} ` : ''}
            {t(language, keyStore.desktop ? 'dialog.settings.apiKeyStorageDesktop' : 'dialog.settings.apiKeyStorageWeb')}
          </small>
          {(keyStored || keyInput) && !clearKey && (
            <button
              type="button"
              className="kura-btn kura-btn-sm kura-btn-danger"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                setClearKey(true);
                setKeyInput('');
              }}
            >
              {t(language, 'dialog.settings.apiKeyDelete')}
            </button>
          )}
          {!keyStore.desktop && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={rememberKey} onChange={(e) => setRememberKey(e.target.checked)} />
              <span>{t(language, 'dialog.settings.apiKeyRememberSession')}</span>
            </label>
          )}
        </div>
      )}

      <div className="kura-form-grid">
        {!localMode && (
        <div className="kura-form-field">
          <label htmlFor="ai-model">{t(language, 'dialog.settings.model')}</label>
          <input
            id="ai-model"
            className="kura-input"
            value={draft.model}
            list="ai-model-suggestions"
            autoComplete="off"
            placeholder={spec.defaultModel}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
          <datalist id="ai-model-suggestions">
            {modelSuggestions(draft).map((model) => <option key={model} value={model} />)}
          </datalist>
        </div>
        )}
        <div className="kura-form-field">
          <label htmlFor="ai-temp">
            {t(language, 'dialog.settings.temperature')} ({draft.temperature})
          </label>
          <input
            id="ai-temp"
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={draft.temperature}
            title={t(language, 'ui.sliderResetTip')}
            onDoubleClick={() => setDraft({ ...draft, temperature: 0.2 })}
            onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
          />
        </div>
      </div>

      {!localMode && (
      <div className="kura-form-field">
        <label htmlFor="ai-url">{t(language, 'dialog.settings.baseUrl')}</label>
        <input
          id="ai-url"
          className="kura-input"
          placeholder={spec.defaultBaseUrl || 'https://'}
          value={draft.baseUrl}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={urlError ? 'ai-url-error ai-url-hint' : 'ai-url-hint'}
          onChange={(e) => {
            setUrlError(null);
            setDraft({ ...draft, baseUrl: e.target.value });
          }}
        />
        {urlError && (
          <small id="ai-url-error" role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600 }}>
            {urlError}
          </small>
        )}
        <small id="ai-url-hint" style={{ fontSize: 11, opacity: 0.85 }}>
          {t(language, 'dialog.settings.baseUrlHint')}
        </small>
      </div>
      )}

      <div className="kura-form-field">
        <label htmlFor="ai-hosts">{t(language, 'dialog.settings.allowedHosts')}</label>
        <textarea
          id="ai-hosts"
          className="kura-input"
          rows={4}
          spellCheck={false}
          style={{ fontFamily: 'monospace', fontSize: 11.5, height: 'auto', resize: 'vertical' }}
          value={hostsText}
          aria-describedby="ai-hosts-hint"
          onChange={(e) => setHostsText(e.target.value)}
        />
        <small id="ai-hosts-hint" style={{ fontSize: 11, opacity: 0.85 }}>
          {t(language, 'dialog.settings.allowedHostsHint')}
        </small>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setHostsText(DEFAULT_ALLOWED_HOSTS.join('\n'))}
        >
          {t(language, 'dialog.settings.allowedHostsReset')}
        </button>
      </div>

      <div className={`kura-callout ${external ? 'is-warning' : 'is-local'}`}>
        {external ? <Cloud size={15} /> : <ShieldCheck size={15} />}
        <span>
          {external
            ? t(language, 'dialog.settings.aiPrivacyExternal', { provider: spec.label })
            : t(language, 'dialog.settings.aiPrivacyLocal')}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="kura-btn"
          disabled={test?.busy}
          title={t(language, 'dialog.settings.testConnection')}
          onClick={() => void runConnectionTest()}
        >
          {test?.busy ? t(language, 'dialog.settings.testing') : t(language, 'dialog.settings.testConnection')}
        </button>
        <button type="button" className="kura-btn kura-btn-primary" onClick={() => void handleSave()}>
          {t(language, 'dialog.settings.saveAi')}
        </button>
      </div>
      <div role="status" aria-live="polite" style={{ minHeight: 18 }}>
        {test && !test.busy && (
          <span
            className={`kura-callout ${test.ok ? 'is-local' : 'is-warning'}`}
            style={{ display: 'flex', fontWeight: 600 }}
          >
            {test.ok ? '✓ ' : '✕ '}{test.text}
          </span>
        )}
      </div>
    </div>
  );
};
