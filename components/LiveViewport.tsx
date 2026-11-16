'use client';

import { useEffect, useRef, useState } from 'react';
import type { FrameEvent } from '@/lib/types';

interface Props {
  frame: FrameEvent | null;
  frameCount: number;
  connected: boolean;
  screencasting: boolean;
  size: { width: number; height: number };
}

export function LiveViewport({ frame, frameCount, connected, screencasting, size }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!frame?.data) return;
    const image = imageRef.current ?? new Image();
    imageRef.current = image;

    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const ratio = window.devicePixelRatio || 1;
      canvas.width = image.naturalWidth * ratio;
      canvas.height = image.naturalHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
      setRendered(true);
    };

    image.src = `data:image/jpeg;base64,${frame.data}`;
  }, [frame]);

  return (
    <section className="viewport-panel">
      <div className="panel-heading">
        <div className="heading-left">
          <span className="live-dot" data-active={connected && screencasting} />
          <h2>Live Viewport</h2>
        </div>
        <div className="viewport-meta">
          <span>{size.width || frame?.metadata?.deviceWidth || 1280}×{size.height || frame?.metadata?.deviceHeight || 720}</span>
          <span className="divider" />
          <span>{frameCount} frames</span>
        </div>
      </div>

      <div className="viewport-stage">
        <canvas
          ref={canvasRef}
          className="viewport-canvas"
          style={{ aspectRatio: `${size.width || 16} / ${size.height || 9}` }}
        />
        {!rendered && (
          <div className="viewport-placeholder">
            <img src="/logo.png" alt="" className="placeholder-logo" />
            <p>Waiting for the first frame…</p>
            <span>Open a page to begin streaming.</span>
          </div>
        )}
      </div>
    </section>
  );
}
