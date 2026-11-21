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

import React, { useEffect, useState } from 'react';
import { Cloud, ShieldCheck } from 'lucide-react';
import { getApiKeyStore } from '../../ai/apiKeyStore';
import { loadKeyState } from '../../ai/aiConfigState';
import { getAllowedHostsSync, loadAllowedHosts, parseHostList, saveAllowedHosts } from '../../ai/allowedHosts';
import { COMPAT_PRESET_IDS, COMPAT_PRESETS, PROVIDERS, specFor } from '../../ai/providerCatalog';
import { DEFAULT_ALLOWED_HOSTS, isAllowedProviderUrl, isLoopbackUrl } from '../../ai/providerSecurity';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { AiCompatPresetId, AiConfig, AiProviderType } from '../../types/kura';

type Draft = Pick<AiConfig, 'provider' | 'compatPreset' | 'model' | 'baseUrl' | 'temperature'>;

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
  const [hostsText, setHostsText] = useState(() => getAllowedHostsSync().join('\n'));

  useEffect(() => {
    if (!open) return;
    setDraft(aiConfig);
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
    setKeyInput('');
    setClearKey(false);
    setKeyStored(false);
    void loadKeyState({ ...aiConfig, ...next, apiKey: '' }, keyStore).then((state) => {
      setKeyStored(Boolean(state.keyStored || state.apiKey));
      if (!keyStore.desktop) setKeyInput(state.apiKey);
    });
  };

  const handleSave = async () => {
    const { hosts, invalid } = parseHostList(hostsText.split(/\r?\n/));
    if (invalid.length) {
      addToast(t(language, 'dialog.settings.allowedHostsInvalid', { list: invalid.join(', ') }), 'error');
      return;
    }
    let allowed = hosts;
    if (hosts.join('\n') !== getAllowedHostsSync().join('\n')) {
      try {
        allowed = await saveAllowedHosts(hosts);
      } catch {
        addToast(t(language, 'dialog.settings.allowedHostsCancelled'), 'info');
        return;
      }
    }
    const url = (draft.baseUrl.trim() || spec.defaultBaseUrl).replace(/\/+$/, '');
    if (url && !isAllowedProviderUrl(url, allowed)) {
      let host = url;
      try {
        host = new URL(url).hostname;
      } catch {
        // URL inválida: se muestra tal cual.
      }
      addToast(
        isLoopbackUrl(url) || !/^https:/i.test(url)
          ? t(language, 'ai.error.endpointBlocked')
          : t(language, 'dialog.settings.hostNotInList', { host }),
        'error',
      );
      return;
    }
    keyStore.setRememberInSession(rememberKey);
    const typedKey = keyInput.trim();
    const keyChanged = clearKey || (keyStore.desktop ? typedKey.length > 0 : typedKey !== aiConfig.apiKey);
    if (keyChanged) setAiConfig({ ...draft, apiKey: clearKey ? '' : typedKey });
    // Sin clave nueva: en escritorio se conserva la del llavero de la ranura elegida (solo su existencia).
    else setAiConfig({ ...draft, ...(keyStore.desktop ? { keyStored } : {}) });
    addToast(t(language, 'toast.settingsSaved'), 'success');
    onSaved();
  };

  const external = !isLoopbackUrl(draft.baseUrl.trim() || spec.defaultBaseUrl) && (keyStored || keyInput.trim().length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="kura-form-field">
        <label htmlFor="ai-provider">{t(language, 'dialog.settings.aiProvider')}</label>
        <select
          id="ai-provider"
          className="kura-select"
          value={draft.provider}
          onChange={(e) => switchTo({ ...draft, provider: e.target.value as AiProviderType })}
        >
          <option value="gemini">{PROVIDERS.gemini.label}</option>
          <option value="openai">{PROVIDERS.openai.label}</option>
          <option value="anthropic">{PROVIDERS.anthropic.label}</option>
          <option value="ollama">Ollama (Local)</option>
          <option value="openai_compatible">{t(language, 'dialog.settings.providerCompat')}</option>
        </select>
      </div>

      {isCompat && (
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

      {draft.provider !== 'ollama' && (
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
        <div className="kura-form-field">
          <label htmlFor="ai-model">{t(language, 'dialog.settings.model')}</label>
          <input
            id="ai-model"
            className="kura-input"
            value={draft.model}
            placeholder={spec.defaultModel}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
        </div>
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

      <div className="kura-form-field">
        <label htmlFor="ai-url">{t(language, 'dialog.settings.baseUrl')}</label>
        <input
          id="ai-url"
          className="kura-input"
          placeholder={spec.defaultBaseUrl || 'https://'}
          value={draft.baseUrl}
          aria-describedby="ai-url-hint"
          onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
        />
        <small id="ai-url-hint" style={{ fontSize: 11, opacity: 0.85 }}>
          {t(language, 'dialog.settings.baseUrlHint')}
        </small>
      </div>

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

      <button type="button" className="kura-btn kura-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => void handleSave()}>
        {t(language, 'dialog.settings.saveAi')}
      </button>
    </div>
  );
};
