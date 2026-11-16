'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Layout';
import { Center } from '@astryxdesign/core/Center';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import type { FrameEvent } from '@/lib/types';

interface Props {
  frame: FrameEvent | null;
  frameCount: number;
  connected: boolean;
  screencasting: boolean;
  size: { width: number; height: number };
  lastActivityAt: number;
  onHide: () => void;
}

const IDLE_MS = 25_000;

const fill: CSSProperties = { flex: 1, minHeight: 0, minWidth: 0, width: '100%' };
const stage: CSSProperties = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  overflow: 'hidden',
  position: 'relative',
};
const canvasStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
  borderRadius: 'var(--radius-md)',
};
const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
};

const SLEEP_CSS = `
@keyframes megha-breathe {
  0%, 100% { opacity: 0.45; transform: scale(0.96); }
  50% { opacity: 0.85; transform: scale(1.04); }
}
.megha-sleep-logo { animation: megha-breathe 4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .megha-sleep-logo { animation: none; opacity: 0.7; }
}
`;

export function LiveViewport({ frame, frameCount, connected, screencasting, size, lastActivityAt, onHide }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const [sleeping, setSleeping] = useState(false);

  useEffect(() => {
    if (Date.now() - lastActivityAt < IDLE_MS) setSleeping(false);
  }, [lastActivityAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSleeping(Date.now() - lastActivityAt >= IDLE_MS);
    }, 5000);
    return () => clearInterval(timer);
  }, [lastActivityAt]);

  useEffect(() => {
    if (!frame?.data || sleeping) return;
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
  }, [frame, sleeping]);

  const live = connected && screencasting && !sleeping;

  return (
    <Card variant="default" padding={0} height="100%" style={fill}>
      <style>{SLEEP_CSS}</style>
      <VStack gap={0} style={fill}>
        <HStack gap={3} vAlign="center" width="100%" padding={3}>
          <Heading level={3}>Live Viewport</Heading>
          <StackItem size="fill" />
          <Text type="supporting" color="secondary">
            {sleeping ? 'Resting' : live ? 'Live' : 'Waiting'}
          </Text>
          <Text type="supporting" color="secondary">
            {size.width}×{size.height} · {frameCount} frames
          </Text>
          <IconButton
            label="Hide browser"
            tooltip="Hide browser"
            size="sm"
            variant="ghost"
            icon={<Icon icon={ChevronDoubleRightIcon} size="sm" />}
            onClick={onHide}
          />
        </HStack>

        <VStack style={stage} padding={3} hAlign="center" vAlign="center">
          <canvas ref={canvasRef} style={{ ...canvasStyle, visibility: sleeping || !rendered ? 'hidden' : 'visible' }} aria-label="Live browser viewport" />

          {(sleeping || !rendered) && (
            <Center style={overlayStyle}>
              <VStack gap={3} hAlign="center" vAlign="center">
                <img
                  src="/logo.png"
                  alt=""
                  className={sleeping ? 'megha-sleep-logo' : undefined}
                  width={40}
                  height={40}
                  style={{ objectFit: 'contain' }}
                />
                <VStack gap={0} hAlign="center">
                  <Text weight="semibold">{sleeping ? 'Browser is resting' : 'Waiting for the first frame…'}</Text>
                  <Text type="supporting" color="secondary">
                    {sleeping ? 'Megha will wake it when there is work to do.' : 'Open a page to begin streaming.'}
                  </Text>
                </VStack>
              </VStack>
            </Center>
          )}
        </VStack>
      </VStack>
    </Card>
  );
}
