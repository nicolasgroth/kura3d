/**
 * @file src/components/about/AboutDialog.tsx
 * @description Diálogo «Acerca de»: qué es el producto, su sentido, cómo se construyó, autoría, licencia,
 * versión, enlaces y las bibliotecas abiertas que usa. Todo el texto sale de i18n y el nombre, de `BRAND`.
 * `AboutLayer` lo monta junto con el huevo de pascua y lo abre cuando `activeDialog === 'about'`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { BRAND } from '../../brand';
import { t } from '../../i18n';
import type { TranslationKey } from '../../i18n/translations';
import { useKuraStore } from '../../store/useKuraStore';
import { pickPurposeKey } from '../../utils/aboutPurpose';
import { ABOUT_LIBS, GUIDES_URL, REPO_URL } from '../../utils/aboutInfo';
import { triggerEgg } from '../../utils/logoEasterEgg';
import { NativeModal } from '../NativeModal';
import { EasterEggHost } from './EasterEggHost';
import '../../styles/about.css';

/** `random` se inyecta para probar la frase al azar; por defecto `Math.random`. */
export const AboutDialog: React.FC<{ open: boolean; onClose: () => void; random?: () => number }> = ({
  open,
  onClose,
  random,
}) => {
  const language = useKuraStore((s) => s.language);
  const name = BRAND.name;
  // Una frase por apertura: se sortea al pasar de cerrado a abierto y queda fija mientras siga abierto.
  const [wasOpen, setWasOpen] = useState(open);
  const [purposeKey, setPurposeKey] = useState(() => pickPurposeKey(random) as TranslationKey);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPurposeKey(pickPurposeKey(random) as TranslationKey);
  }
  // El diálogo sigue montado al cerrarse: cada apertura empieza arriba, con el logo a la vista.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open]);
  const newTab = t(language, 'about.linkNote');

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'about.title', { name })}
      className="kura-dialog-about"
      footer={
        <button type="button" className="kura-btn" onClick={onClose}>
          {t(language, 'dialog.close')}
        </button>
      }
    >
      {/* La zona que se desplaza es enfocable y con nombre: con teclado se recorre con flechas, AvPág y Espacio. */}
      <div className="kura-about" ref={scrollRef} role="region" tabIndex={0} aria-label={t(language, 'about.scrollRegion', { name })}>
        <img src="/branding/kurra-studio-icono.svg" alt="" className="kura-about-logo" width={64} height={64} />
        <section aria-labelledby="about-what">
          <h3 id="about-what">{t(language, 'about.whatTitle')}</h3>
          <p>{t(language, 'about.what', { name })}</p>
        </section>

        <section aria-labelledby="about-purpose">
          <h3 id="about-purpose">{t(language, 'about.purposeTitle')}</h3>
          <p className="kura-about-quote">{t(language, purposeKey, { name })}</p>
        </section>

        <section aria-labelledby="about-how">
          <h3 id="about-how">{t(language, 'about.howTitle')}</h3>
          <p>{t(language, 'about.how')}</p>
        </section>

        <section aria-labelledby="about-author">
          <h3 id="about-author">{t(language, 'about.authorTitle')}</h3>
          <p className="kura-about-meta">
            <span>{t(language, 'about.author', { author: BRAND.author, organization: BRAND.organization })}</span>
            <span>{t(language, 'about.version', { version: BRAND.version })}</span>
          </p>
          <p>{t(language, 'about.license', { license: BRAND.license })}</p>
        </section>

        <section aria-labelledby="about-links">
          <h3 id="about-links">{t(language, 'about.linksTitle')}</h3>
          <ul className="kura-about-links">
            <li>
              <a href={GUIDES_URL} target="_blank" rel="noopener noreferrer" title={newTab}>
                {t(language, 'about.linkGuides')}
              </a>
            </li>
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" title={newTab}>
                {t(language, 'about.linkRepo')}
              </a>
            </li>
          </ul>
        </section>

        <section aria-labelledby="about-libs">
          <h3 id="about-libs">{t(language, 'about.libsTitle')}</h3>
          <p>{t(language, 'about.libsIntro', { name })}</p>
          <table className="kura-about-libs">
            <caption className="sr-only">{t(language, 'about.libsCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t(language, 'about.libsColName')}</th>
                <th scope="col">{t(language, 'about.libsColUse')}</th>
                <th scope="col">{t(language, 'about.libsColLicense')}</th>
              </tr>
            </thead>
            <tbody>
              {ABOUT_LIBS.map((lib) => (
                <tr key={lib.pkg}>
                  <th scope="row">{lib.name}</th>
                  <td>{t(language, lib.useKey)}</td>
                  <td>{lib.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <button
          type="button"
          className="kura-about-egg-btn"
          onClick={triggerEgg}
          title={t(language, 'about.egg.button')}
        >
          {t(language, 'about.egg.button')}
        </button>
      </div>
    </NativeModal>
  );
};

/** Monta el diálogo «Acerca de» (según `activeDialog`) y el huevo de pascua del logo. */
export const AboutLayer: React.FC = () => {
  const activeDialog = useKuraStore((s) => s.activeDialog);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  return (
    <>
      <AboutDialog
        open={activeDialog === 'about'}
        onClose={() => {
          if (useKuraStore.getState().activeDialog === 'about') setActiveDialog(null);
        }}
      />
      <EasterEggHost />
    </>
  );
};
