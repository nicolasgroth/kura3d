/**
 * @file src/components/SplashScreen.tsx
 * @description Pantalla de bienvenida animada (Splash Screen) de Kura3D v0.5.0 para entornos
 * nativos (Tauri v2) y Web Studio. Muestra el emblema oficial 3D, marca ISGROTH y progreso real
 * de inicialización del motor geométrico Manifold WASM con cierre automático suave (~900 ms tras
 * quedar listo) y descarte instantáneo mediante clic o tecla Escape.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useState } from 'react';
import { t } from '../i18n';
import { BRAND } from '../brand';
import { useKuraStore } from '../store/useKuraStore';

type SplashPhase = 'visible' | 'leaving' | 'done';

export const SplashScreen: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const engineReady = useKuraStore((s) => s.engineReady);
  const engineError = useKuraStore((s) => s.engineError);

  const [phase, setPhase] = useState<SplashPhase>('visible');

  // Inicia la transición de salida suave y desmonta el overlay al completar el fade-out
  const dismiss = useCallback(() => {
    setPhase((prev) => (prev === 'visible' ? 'leaving' : prev));
  }, []);

  // Auto-oculta el splash ~900 ms después de que el motor Manifold WASM termine de inicializar
  useEffect(() => {
    if (phase !== 'visible') return;
    if (!engineReady && !engineError) return;

    const timer = window.setTimeout(() => {
      dismiss();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [engineReady, engineError, phase, dismiss]);

  // Desmontaje definitivo tras la animación CSS de desvanecimiento
  useEffect(() => {
    if (phase !== 'leaving') return;

    const timer = window.setTimeout(() => {
      setPhase('done');
    }, 280);

    return () => window.clearTimeout(timer);
  }, [phase]);

  // Permite cerrar el splash al instante con la tecla Escape sin esperar el temporizador
  useEffect(() => {
    if (phase !== 'visible') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, dismiss]);

  if (phase === 'done') {
    return null;
  }

  const isReady = engineReady || Boolean(engineError);

  return (
    <div
      className={`kura-splash-overlay ${phase === 'leaving' ? 'is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={t(language, 'app.studioVersion', { name: BRAND.name, version: BRAND.version })}
      onClick={dismiss}
    >
      <div className="kura-splash-glow" aria-hidden="true" />

      <div className="kura-splash-card">
        <div className="kura-splash-emblem-wrap">
          <img
            src="/branding/kura3d-emblem.png"
            alt={t(language, 'app.emblemAlt', { name: BRAND.name })}
            className="kura-splash-emblem"
            width={112}
            height={112}
          />
        </div>

        <div className="kura-splash-title-row">
          <span className="kura-splash-wordmark">{BRAND.name}</span>
          <span className="kura-splash-version">v{BRAND.version}</span>
        </div>

        <p className="kura-splash-subtitle">{t(language, 'splash.subtitle')}</p>
        <p className="kura-splash-org">ISGROTH — Innovación y Soluciones GROTH</p>

        <div className="kura-splash-progress-wrap">
          <div
            className="kura-splash-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={isReady ? 100 : 58}
          >
            <div
              className={`kura-splash-progress-bar ${isReady ? 'is-ready' : 'is-loading'}`}
            />
          </div>
          <span className="kura-splash-status-text">
            {isReady ? t(language, 'splash.ready') : t(language, 'splash.loadingEngine')}
          </span>
        </div>

        <span className="kura-splash-skip">{t(language, 'splash.skip')}</span>
      </div>
    </div>
  );
};
