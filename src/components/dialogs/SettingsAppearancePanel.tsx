/**
 * @file src/components/dialogs/SettingsAppearancePanel.tsx
 * @description Pestaña Apariencia de Ajustes: esquema claro/oscuro/sistema y temas WCAG con vista previa en vivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { ReferenceOpacitySetting } from '../settings/ReferenceOpacitySetting';
import { FloatingBarSetting } from '../settings/FloatingBarSetting';
import { THEME_PRESETS, type ColorSchemePreference } from '../../types/kura';
import { useResolvedDarkScheme } from './useResolvedDarkScheme';

export const SettingsAppearancePanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const setColorScheme = useKuraStore((s) => s.setColorScheme);
  const themePreset = useKuraStore((s) => s.themePreset);
  const previewThemePreset = useKuraStore((s) => s.previewThemePreset);
  const setThemePreset = useKuraStore((s) => s.setThemePreset);
  const setPreviewThemePreset = useKuraStore((s) => s.setPreviewThemePreset);
  const isRenderedDark = useResolvedDarkScheme(colorScheme);

  const schemeOptions: Array<{
    value: ColorSchemePreference;
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: 'system', label: t(language, 'topbar.theme.system'), icon: <Monitor size={13} /> },
    { value: 'dark', label: t(language, 'topbar.theme.dark'), icon: <Moon size={13} /> },
    { value: 'light', label: t(language, 'topbar.theme.light'), icon: <Sun size={13} /> },
  ];

  return (
    <div className="kura-appearance-panel" role="tabpanel" id="settings-panel-appearance" aria-labelledby="settings-tab-appearance">
      <div className="kura-form-field">
        <label htmlFor="settings-scheme-group">{t(language, 'topbar.themeToggle')}</label>
        <div
          id="settings-scheme-group"
          className="kura-segmented"
          role="group"
          aria-label={t(language, 'topbar.themeToggle')}
          style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}
        >
          {schemeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`kura-btn ${colorScheme === opt.value ? 'is-active' : ''}`}
              aria-pressed={colorScheme === opt.value}
              onClick={() => setColorScheme(opt.value)}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <ReferenceOpacitySetting />
      <FloatingBarSetting />

      <div className="kura-themes-header">
        <div>
          <h3 className="kura-themes-title">{t(language, 'dialog.settings.themesTitle')}</h3>
          <p className="kura-themes-hint">{t(language, 'dialog.settings.themesHint')}</p>
        </div>
        {previewThemePreset && (
          <span className="kura-theme-preview-pill">
            {t(language, 'dialog.settings.themePreviewBadge')}
          </span>
        )}
      </div>

      <div className="kura-theme-grid">
        {THEME_PRESETS.map((preset) => {
          const colors = isRenderedDark ? preset.previewDark : preset.previewLight;
          const isActive = themePreset === preset.id;
          const isPreviewing = previewThemePreset === preset.id;
          const name = t(language, `theme.${preset.id}.name` as TranslationKey);
          const desc = t(language, `theme.${preset.id}.desc` as TranslationKey);

          return (
            <button
              key={preset.id}
              type="button"
              className={`kura-theme-card ${isActive ? 'is-active' : ''} ${
                isPreviewing ? 'is-previewing' : ''
              }`}
              aria-pressed={isActive}
              onMouseEnter={() => setPreviewThemePreset(preset.id)}
              onMouseLeave={() => setPreviewThemePreset(null)}
              onFocus={() => setPreviewThemePreset(preset.id)}
              onBlur={() => setPreviewThemePreset(null)}
              onClick={() => setThemePreset(preset.id)}
            >
              {/* Maqueta en miniatura del estudio Kurra3D Studio pintada con la paleta exacta del tema */}
              <div
                className="kura-theme-mockup"
                aria-hidden="true"
                style={{
                  backgroundColor: colors.canvas,
                  borderColor: colors.border,
                }}
              >
                <div
                  className="kura-theme-mockup-topbar"
                  style={{
                    backgroundColor: colors.panel,
                    borderBottomColor: colors.border,
                  }}
                >
                  <span className="kura-theme-mockup-dots">
                    <i style={{ backgroundColor: colors.secondary }} />
                    <i style={{ backgroundColor: colors.accent }} />
                    <i style={{ backgroundColor: colors.border }} />
                  </span>
                  <span
                    className="kura-theme-mockup-pill"
                    style={{ backgroundColor: colors.accent }}
                  />
                </div>

                <div className="kura-theme-mockup-body">
                  <div
                    className="kura-theme-mockup-sidebar"
                    style={{
                      backgroundColor: colors.panel,
                      borderRightColor: colors.border,
                    }}
                  >
                    <span style={{ backgroundColor: colors.border }} />
                    <span style={{ backgroundColor: colors.accent }} />
                    <span style={{ backgroundColor: colors.border }} />
                  </div>

                  <div className="kura-theme-mockup-viewport">
                    <svg
                      viewBox="0 0 40 36"
                      width="34"
                      height="30"
                      className="kura-theme-mockup-cube"
                    >
                      <polygon
                        points="20,4 34,11 20,18 6,11"
                        fill={colors.accent}
                        fillOpacity="0.88"
                        stroke={colors.text}
                        strokeOpacity="0.35"
                        strokeWidth="1"
                      />
                      <polygon
                        points="6,11 20,18 20,32 6,25"
                        fill={colors.panel}
                        stroke={colors.accent}
                        strokeWidth="1.2"
                      />
                      <polygon
                        points="34,11 20,18 20,32 34,25"
                        fill={colors.secondary}
                        fillOpacity="0.85"
                        stroke={colors.text}
                        strokeOpacity="0.35"
                        strokeWidth="1"
                      />
                    </svg>
                  </div>

                  <div
                    className="kura-theme-mockup-inspector"
                    style={{
                      backgroundColor: colors.panel,
                      borderLeftColor: colors.border,
                    }}
                  >
                    <span style={{ backgroundColor: colors.text, opacity: 0.45 }} />
                    <span style={{ backgroundColor: colors.border }} />
                    <span
                      className="kura-theme-mockup-cta"
                      style={{ backgroundColor: colors.secondary }}
                    />
                  </div>
                </div>
              </div>

              <div className="kura-theme-card-meta">
                <div className="kura-theme-card-head">
                  <span className="kura-theme-card-name">{name}</span>
                  <span
                    className={`kura-wcag-badge ${
                      preset.wcagLevel === 'AAA' ? 'is-aaa' : 'is-aa'
                    }`}
                  >
                    WCAG {preset.wcagLevel}
                  </span>
                </div>

                <p className="kura-theme-card-desc">{desc}</p>

                <div className="kura-theme-card-badges">
                  {isActive ? (
                    <span className="kura-theme-status-badge is-active">
                      <Check size={11} />
                      <span>{t(language, 'dialog.settings.themeActiveBadge')}</span>
                    </span>
                  ) : preset.id === 'obsidian' ? (
                    <span className="kura-theme-status-badge">
                      {t(language, 'dialog.settings.themeDefaultBadge')}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
