'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import type { FrameEvent } from '@/lib/types';

interface Props {
  frame: FrameEvent | null;
  frameCount: number;
  connected: boolean;
  screencasting: boolean;
  size: { width: number; height: number };
}

const fill: CSSProperties = { flex: 1, minHeight: 0, minWidth: 0, width: '100%' };
const stage: CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--spacing-3)',
  overflow: 'hidden',
};
const canvasStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
  borderRadius: 'var(--radius-md)',
};

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

  const live = connected && screencasting;

  return (
    <Card variant="default" padding={0} height="100%" style={fill}>
      <VStack gap={0} style={fill}>
        <HStack gap={3} vAlign="center" width="100%" style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
          <Heading level={3}>Live Viewport</Heading>
          <StackItem size="fill" />
          <Badge variant={live ? 'green' : 'neutral'} label={live ? 'Live' : 'Waiting'} />
          <Text type="supporting" color="secondary">
            {size.width}×{size.height} · {frameCount} frames
          </Text>
        </HStack>

        <VStack style={stage}>
          <canvas ref={canvasRef} style={canvasStyle} aria-label="Live browser viewport" />
          {!rendered && (
            <VStack gap={2} align="center" style={{ position: 'absolute', textAlign: 'center' }}>
              <img src="/logo.png" alt="" style={{ width: 'var(--spacing-12)', height: 'var(--spacing-12)', objectFit: 'contain', opacity: 0.5 }} />
              <Text type="supporting" color="secondary">Waiting for the first frame…</Text>
            </VStack>
          )}
        </VStack>
      </VStack>
    </Card>
  );
}
