/**
 * @file src/components/BrandLogo.tsx
 * @description Logo completo de la marca. Elige la variante clara u oscura según el esquema de color
 * activo (el texto del logo claro no se lee sobre fondo oscuro) y toma el texto alternativo de `BRAND`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { BRAND } from '../brand';
import { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from '../brandAssets';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { useResolvedDarkScheme } from './dialogs/useResolvedDarkScheme';
import '../styles/brandLogo.css';

/** Archivos del logo completo (proporción 1050 x 430), con la base de la app (`brandAssets`). */
export { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT };

/** Ruta del logo según el esquema resuelto. */
export function brandLogoSrc(dark: boolean): string {
  return dark ? BRAND_LOGO_DARK : BRAND_LOGO_LIGHT;
}

export interface BrandLogoProps {
  /** Ancho en px (el alto sale de la proporción). */
  width?: number;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ width = 240, className }) => {
  const language = useKuraStore((s) => s.language);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const dark = useResolvedDarkScheme(colorScheme);
  return (
    <img
      src={brandLogoSrc(dark)}
      alt={t(language, 'app.lockupAlt', { name: BRAND.name })}
      className={className ? `kura-brand-logo ${className}` : 'kura-brand-logo'}
      width={width}
      height={Math.round((width * 430) / 1050)}
      data-brand-scheme={dark ? 'dark' : 'light'}
    />
  );
};
