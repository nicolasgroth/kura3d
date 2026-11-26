/**
 * @file src/components/Viewport3D.tsx
 * @description Visor 3D de Kurra Studio (React Three Fiber): monta el Canvas con la escena y compone el HUD (vistas, rejilla, modos, menú contextual, consejos y dimensiones) desde `./viewport/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useKuraStore } from '../store/useKuraStore';
import { sceneBedStatus } from './viewport/plateBedStatus';
import { SceneContent } from './viewport/SceneContent';
import { useObjectContextMenu } from './viewport/useObjectContextMenu';
import { EmptySceneOverlay } from './viewport/EmptySceneOverlay';
import { ViewportHudTop } from './viewport/ViewportHudTop';
import { ObjectContextMenu } from './viewport/ObjectContextMenu';
import { BackgroundContextMenu } from './viewport/BackgroundContextMenu';
import { ViewportOverlays } from './viewport/ViewportOverlays';
import { FloatingActionBar } from './viewport/FloatingActionBar';

export const Viewport3D: React.FC = () => {
  const viewportRef = useRef<HTMLElement | null>(null);
  const { contextMenu, setContextMenu, ctxTarget, handleObjectContextMenu, handleBackgroundContextMenu, handleBackgroundPointerDown } = useObjectContextMenu(viewportRef);
  const activeTool = useKuraStore((s) => s.activeTool);
  const clearSelection = useKuraStore((s) => s.clearSelection);
  const objects = useKuraStore((s) => s.objects);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const plates = useKuraStore((s) => s.plates);
  const isOutOfBounds = useMemo(
    () => sceneBedStatus(objects, printerProfile, plates) === 'outOfBounds',
    [objects, printerProfile, plates],
  );

  return (
    <main ref={viewportRef} className="kura-viewport-wrap" onPointerDownCapture={handleBackgroundPointerDown} onContextMenu={handleBackgroundContextMenu}>
      {/* La barra de vista va antes del lienzo: en el orden de tabulación, vista → visor. */}
      <ViewportHudTop />
      <Canvas
        className={activeTool === 'paint' ? 'kura-viewport-canvas is-painting' : 'kura-viewport-canvas'}
        // three r182+: PCFSoftShadowMap (el `shadows` por defecto de r3f) ya no existe en WebGL y PCFShadowMap es suave.
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [115, 95, 130], fov: 42, near: 0.5, far: 4000 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, localClippingEnabled: true }}
        onPointerMissed={(e) => {
          setContextMenu(null);
          if (e.button === 0 && activeTool === 'select') {
            clearSelection();
          }
        }}
      >
        <SceneContent
          isOutOfBounds={isOutOfBounds}
          onObjectContextMenu={handleObjectContextMenu}
        />
      </Canvas>

      {objects.length === 0 && <EmptySceneOverlay />}

      {contextMenu && ctxTarget && (
        <ObjectContextMenu menu={contextMenu} target={ctxTarget} onClose={() => setContextMenu(null)} />
      )}
      {contextMenu && !contextMenu.objectId && (
        <BackgroundContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}

      <ViewportOverlays />
      <FloatingActionBar contextMenuOpen={contextMenu !== null} onMore={handleObjectContextMenu} />
    </main>
  );
};
