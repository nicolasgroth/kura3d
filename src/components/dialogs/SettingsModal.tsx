/**
 * @file src/components/dialogs/SettingsModal.tsx
 * @description Diálogo de ajustes globales: apariencia y temas, IA, MCP y Acerca de.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect } from 'react';
import { Palette, Ruler } from 'lucide-react';
import { t } from '../../i18n';
import { generateRandomTokenHex, useKuraStore } from '../../store/useKuraStore';
import { rotateMcpBridgeToken, useMcpBridgeStatus } from '../../utils/mcpBridgeClient';
import { describeMcpBridge } from '../../utils/mcpBridgeHealth';
import { NativeModal } from '../NativeModal';
import { isTauriRuntime } from '../../utils/platformBridge';
import { AiSettingsPanel } from '../settings/AiSettingsPanel';
import { McpSetupPanel } from '../settings/McpSetupPanel';
import { McpTokenField } from '../settings/McpTokenField';
import { HistorySettings } from '../settings/HistorySettings';
import { SplitSettings } from '../settings/SplitSettings';
import { MeasuresFields } from '../settings/MeasuresFields';
import { RecentProjectsSettings } from '../settings/RecentProjectsSettings';
import { SettingsTabs } from '../settings/SettingsTabs';
import { SettingsAppearancePanel } from './SettingsAppearancePanel';

/** Modal 8: Ajustes globales (Apariencia/Temas WCAG, IA, MCP y Acerca de). */
export const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const setPreviewThemePreset = useKuraStore((s) => s.setPreviewThemePreset);
  const mcpConnected = useKuraStore((s) => s.mcpConnected);
  const mcpConfig = useKuraStore((s) => s.mcpConfig);
  const setMcpConfig = useKuraStore((s) => s.setMcpConfig);
  const bridgeStatus = useMcpBridgeStatus();
  const tab = useKuraStore((s) => s.settingsTab);
  const setTab = useKuraStore((s) => s.setSettingsTab);
  const addToast = useKuraStore((s) => s.addToast);

  // Garantiza que cualquier vista previa en vivo se revierta al cerrar o desmontar el modal
  useEffect(() => {
    if (!open) {
      setPreviewThemePreset(null);
    }
  }, [open, setPreviewThemePreset]);

  useEffect(() => {
    return () => {
      setPreviewThemePreset(null);
    };
  }, [setPreviewThemePreset]);

  const handleClose = () => {
    setPreviewThemePreset(null);
    onClose();
  };

  // Rotación efectiva: el servidor revoca el token viejo antes de guardar el nuevo en Ajustes.
  const handleRegenerateToken = async () => {
    const nextToken = generateRandomTokenHex(32);
    const result = await rotateMcpBridgeToken(nextToken);
    if (result === 'failed') {
      addToast(t(language, 'toast.mcpTokenRotateFailed'), 'error');
      return;
    }
    setMcpConfig({ authToken: nextToken });
    if (result === 'rotated') {
      addToast(t(language, 'toast.mcpTokenRotated'), 'success');
    } else if (result === 'rotated_volatile') {
      addToast(t(language, 'toast.mcpTokenRotatedVolatile'), 'info');
    } else {
      addToast(t(language, 'toast.mcpTokenOffline'), 'info');
    }
  };

  // Token escrito a mano: si hay sesión, el servidor lo adopta (rotación); si no, solo se guarda.
  const handleApplyToken = async (nextToken: string) => {
    const result = await rotateMcpBridgeToken(nextToken);
    if (result === 'failed') {
      addToast(t(language, 'toast.mcpTokenRotateFailed'), 'error');
      return;
    }
    setMcpConfig({ authToken: nextToken });
  };

  const bridgeView = describeMcpBridge(language, mcpConfig.enabled, bridgeStatus);
  const bridgePhaseLabel = bridgeView.label;

  return (
    <NativeModal
      open={open}
      onClose={handleClose}
      title={t(language, 'dialog.settings.title')}
      className="kura-dialog-settings"
      footer={
        <>
          <button type="button" className="kura-btn" onClick={handleClose}>
            {t(language, 'dialog.close')}
          </button>
        </>
      }
    >
      <SettingsTabs
        tab={tab}
        onChange={setTab}
        label={t(language, 'dialog.settings.tabsLabel')}
        tabs={[
          { id: 'appearance', label: t(language, 'dialog.settings.tab.appearance'), icon: <Palette size={13} /> },
          { id: 'project', label: t(language, 'dialog.settings.tab.project'), icon: <Ruler size={13} /> },
          { id: 'ai', label: t(language, 'dialog.settings.tab.ai') },
          { id: 'mcp', label: t(language, 'dialog.settings.tab.mcp') },
          { id: 'about', label: t(language, 'dialog.settings.tab.about') },
        ]}
      />

      {tab === 'appearance' && (
        <SettingsAppearancePanel />
      )}

      {tab === 'project' && (
        <div className="kura-measures-panel" role="tabpanel" id="settings-panel-project" aria-labelledby="settings-tab-project">
          <strong style={{ fontSize: 13 }}>{t(language, 'dialog.settings.projectTitle')}</strong>
          <MeasuresFields idPrefix="settings-measures" showHelp />
          <SplitSettings idPrefix="settings-split" />
          <HistorySettings idPrefix="settings-history" />
          <RecentProjectsSettings idPrefix="settings-recent" />
        </div>
      )}

      {tab === 'ai' && (
        <div role="tabpanel" id="settings-panel-ai" aria-labelledby="settings-tab-ai">
          <AiSettingsPanel open={open} onSaved={handleClose} />
        </div>
      )}

      {tab === 'mcp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="tabpanel" id="settings-panel-mcp" aria-labelledby="settings-tab-mcp">
          <strong style={{ fontSize: 13 }}>{t(language, 'dialog.settings.mcpTitle')}</strong>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            {t(language, 'dialog.settings.mcpDesc')}
          </p>

          <div className="kura-card" style={{ gap: 10 }}>
            <label className="kura-switch-row">
              <span>{t(language, 'dialog.settings.mcpEnable')}</span>
              <input
                type="checkbox"
                checked={mcpConfig.enabled}
                onChange={(e) => setMcpConfig({ enabled: e.target.checked })}
              />
            </label>

            <div className="kura-field-row">
              <label className="kura-field-label" htmlFor="mcp-port">
                {t(language, 'dialog.settings.mcpPort')}
              </label>
              <input
                id="mcp-port"
                type="number"
                className="kura-input"
                style={{ width: 96 }}
                min={1024}
                max={65535}
                value={mcpConfig.port}
                onChange={(e) => setMcpConfig({ port: Number(e.target.value) })}
              />
            </div>

            <McpTokenField
              language={language}
              token={mcpConfig.authToken}
              desktop={isTauriRuntime()}
              rotating={bridgeStatus.phase === 'rotating'}
              onApply={(token) => void handleApplyToken(token)}
              onRegenerate={() => void handleRegenerateToken()}
            />

            <label className="kura-switch-row">
              <span>{t(language, 'dialog.settings.mcpReadOnly')}</span>
              <input
                type="checkbox"
                checked={mcpConfig.readOnly || (mcpConnected && bridgeStatus.serverReadOnly)}
                disabled={mcpConnected && bridgeStatus.serverReadOnly}
                onChange={(e) => setMcpConfig({ readOnly: e.target.checked })}
              />
            </label>
            {mcpConnected && bridgeStatus.serverReadOnly && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {t(language, 'dialog.settings.mcpServerReadOnly')}
              </span>
            )}
          </div>

          <div className="kura-field-row">
            <span className="kura-field-label">{t(language, 'dialog.settings.mcpStatus')}</span>
            <span
              className={`kura-pill is-${bridgeView.tone}`}
            >
              <span className="kura-dot" />
              <span role="status" aria-live="polite">
                {bridgePhaseLabel}
              </span>
            </span>
          </div>
          <McpSetupPanel />
        </div>
      )}

      {tab === 'about' && (
        <div className="kura-about-stack" role="tabpanel" id="settings-panel-about" aria-labelledby="settings-tab-about">
          <div className="kura-card">
            <div className="kura-about-header">
              <strong>Kura3D Studio v0.5.0</strong>
              <span className="kura-brand-badge">v0.5.0</span>
            </div>
            <p style={{ margin: 0, fontSize: 12 }}>{t(language, 'dialog.settings.aboutAuthor')}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              {t(language, 'dialog.settings.aboutStack')}
            </p>
          </div>

          <div className="kura-card">
            <span className="kura-section-label" style={{ margin: 0 }}>
              {t(language, 'dialog.settings.brandVariants')}
            </span>
            <div className="kura-brand-showcase">
              <div className="kura-brand-variant-card">
                <img
                  src="/branding/kura3d-lockup.png"
                  alt="Kura3D Official Lockup"
                  className="kura-brand-lockup-img"
                />
              </div>
              <div className="kura-brand-variant-card is-mono">
                <img
                  src="/branding/kura3d-mono.png"
                  alt="Kura3D Monochrome Emblem"
                  className="kura-brand-mono-img"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </NativeModal>
  );
};
