/**
 * @file src/components/LanguageFlag.tsx
 * @description Banderas propias en SVG en línea para el selector de idioma (Windows no dibuja banderas emoji):
 * España, Reino Unido, Alemania, Francia, India y China. Simplificadas para leerse a 16–20 px, en proporción 3:2
 * y decorativas (`aria-hidden`): el nombre accesible es el del idioma, no el del país.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import type { LanguageCode } from '../types/kura';

/** Contenido de cada bandera en un lienzo de 30 × 20. */
const FLAGS: Record<LanguageCode, React.ReactNode> = {
  es: (
    <>
      <rect width="30" height="20" fill="#AA151B" />
      <rect y="5" width="30" height="10" fill="#F1BF00" />
    </>
  ),
  en: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M15 0V20M0 10H30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M15 0V20M0 10H30" stroke="#C8102E" strokeWidth="3.4" />
    </>
  ),
  de: (
    <>
      <rect width="30" height="20" fill="#000000" />
      <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
      <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
    </>
  ),
  fr: (
    <>
      <rect width="30" height="20" fill="#FFFFFF" />
      <rect width="10" height="20" fill="#002395" />
      <rect x="20" width="10" height="20" fill="#ED2939" />
    </>
  ),
  hi: (
    <>
      <rect width="30" height="20" fill="#FFFFFF" />
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.9" />
      <circle cx="15" cy="10" r="0.7" fill="#000080" />
    </>
  ),
  zh: (
    <>
      <rect width="30" height="20" fill="#EE1C25" />
      <path d="M6 2.6l1.18 3.62h3.8l-3.08 2.24 1.18 3.62L6 9.84l-3.08 2.24 1.18-3.62L1.02 6.22h3.8z" fill="#FFFF00" />
      <circle cx="12" cy="2.4" r="0.9" fill="#FFFF00" />
      <circle cx="14" cy="4.6" r="0.9" fill="#FFFF00" />
      <circle cx="14" cy="7.6" r="0.9" fill="#FFFF00" />
      <circle cx="12" cy="9.8" r="0.9" fill="#FFFF00" />
    </>
  ),
};

export const LanguageFlag: React.FC<{ code: LanguageCode; size?: number }> = ({ code, size = 18 }) => (
  <svg
    className="kura-flag"
    viewBox="0 0 30 20"
    width={size}
    height={Math.round((size * 2) / 3)}
    aria-hidden="true"
    focusable="false"
    data-flag={code}
  >
    {FLAGS[code]}
  </svg>
);
