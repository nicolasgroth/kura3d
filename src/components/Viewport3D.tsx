/**
 * @file src/components/Viewport3D.tsx
 * @description Visor 3D de Kura3D (React Three Fiber): monta el Canvas con la escena y compone el HUD (vistas, rejilla, modos, menú contextual, consejos y dimensiones) desde `./viewport/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useKuraStore } from '../store/useKuraStore';
import { checkObjectsOutOfBounds } from './viewport/viewportHelpers';
import { SceneContent } from './viewport/SceneContent';
import { useObjectContextMenu } from './viewport/useObjectContextMenu';
import { EmptySceneOverlay } from './viewport/EmptySceneOverlay';
import { ViewportHudTop } from './viewport/ViewportHudTop';
import { ObjectContextMenu } from './viewport/ObjectContextMenu';
import { BackgroundContextMenu } from './viewport/BackgroundContextMenu';
import { ViewportOverlays } from './viewport/ViewportOverlays';

export const Viewport3D: React.FC = () => {
  const viewportRef = useRef<HTMLElement | null>(null);
  const { contextMenu, setContextMenu, ctxTarget, handleObjectContextMenu, handleBackgroundContextMenu, handleBackgroundPointerDown } = useObjectContextMenu(viewportRef);
  const activeTool = useKuraStore((s) => s.activeTool);
  const clearSelection = useKuraStore((s) => s.clearSelection);
  const objects = useKuraStore((s) => s.objects);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const isOutOfBounds = useMemo(
    () => checkObjectsOutOfBounds(objects, printerProfile),
    [objects, printerProfile],
  );

  return (
    <main ref={viewportRef} className="kura-viewport-wrap" onPointerDownCapture={handleBackgroundPointerDown} onContextMenu={handleBackgroundContextMenu}>
      <Canvas
        className={activeTool === 'paint' ? 'kura-viewport-canvas is-painting' : 'kura-viewport-canvas'}
        shadows
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

      <ViewportHudTop />

      {contextMenu && ctxTarget && (
        <ObjectContextMenu menu={contextMenu} target={ctxTarget} onClose={() => setContextMenu(null)} />
      )}
      {contextMenu && !contextMenu.objectId && (
        <BackgroundContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}

      <ViewportOverlays />
    </main>
  );
};
