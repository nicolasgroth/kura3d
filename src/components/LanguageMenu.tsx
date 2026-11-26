/**
 * @file src/components/LanguageMenu.tsx
 * @description Selector de idioma de la barra superior: botón con la bandera y el código del idioma actual que
 * abre un menú (`menuitemradio`, flechas, Inicio/Fin, Enter, Esc devuelve el foco) con bandera y nombre de cada
 * idioma en su propio idioma (Español, English, Deutsch, Français, हिन्दी, 中文). `LanguageRadioItems` da las
 * mismas opciones para el menú «Más» cuando el selector no cabe en la barra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../types/kura';
import { LanguageFlag } from './LanguageFlag';
import { helpAttrs } from './shell/controlHelp';
import { usePortalMenu } from './shell/usePortalMenu';
import { MenuItem } from './viewport/contextMenu/MenuKit';
import '../styles/languageMenu.css';

export const LanguageMenu: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const setLanguage = useKuraStore((s) => s.setLanguage);
  const menu = usePortalMenu('below');
  const current = SUPPORTED_LANGUAGES.find((spec) => spec.code === language) ?? SUPPORTED_LANGUAGES[0];
  const label = t(language, 'topbar.languageSelect');
  const currentName = t(language, 'r3a.lang.current', { name: current.nativeName });

  return (
    <>
      <button
        type="button"
        className={`kura-btn kura-btn-sm kura-lang-trigger${menu.open ? ' is-active' : ''}`}
        aria-label={currentName}
        {...menu.triggerProps}
        {...helpAttrs('top.language', language)}
        title={currentName}
      >
        <LanguageFlag code={current.code} />
        <span className="kura-lang-code">{current.shortLabel}</span>
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {menu.render(
        label,
        SUPPORTED_LANGUAGES.map((spec) => (
          <MenuItem
            key={spec.code}
            icon={<LanguageFlag code={spec.code} />}
            label={spec.nativeName}
            checked={spec.code === language}
            onSelect={menu.pick(() => setLanguage(spec.code))}
          />
        )),
      )}
    </>
  );
};

/** Opciones de idioma como ítems de radio para el menú «Más». */
export const LanguageRadioItems: React.FC<{ language: LanguageCode; onPick: (code: LanguageCode) => void }> = ({ language, onPick }) => (
  <div role="group" aria-label={t(language, 'topbar.languageSelect')} className="kura-lang-radio-group">
    {SUPPORTED_LANGUAGES.map((spec) => (
      <button
        key={spec.code}
        type="button"
        role="menuitemradio"
        aria-checked={spec.code === language}
        className="kura-btn kura-btn-sm"
        lang={spec.code}
        onClick={() => onPick(spec.code)}
        title={spec.nativeName}
      >
        <LanguageFlag code={spec.code} />
        <span>{spec.nativeName}</span>
        {spec.code === language && <Check size={13} aria-hidden="true" />}
      </button>
    ))}
  </div>
);
