'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { Center } from '@astryxdesign/core/Center';
import { ChevronDoubleRightIcon, HandRaisedIcon } from '@heroicons/react/24/outline';
import type { FrameEvent } from '@/lib/types';

interface Props {
  frame: FrameEvent | null;
  frameCount: number;
  connected: boolean;
  screencasting: boolean;
  size: { width: number; height: number };
  lastActivityAt: number;
  controlMode: 'agent' | 'user';
  onToggleControl: () => void;
  onActivity: () => void;
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
const overlayStyle: CSSProperties = { position: 'absolute', inset: 0 };
const hintStyle: CSSProperties = {
  position: 'absolute',
  insetInline: 0,
  bottom: 0,
  padding: 'var(--spacing-2) var(--spacing-3)',
  background: 'var(--color-background-muted)',
  borderTop: '1px solid var(--color-border)',
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

async function inject(event: Record<string, unknown>, onActivity?: () => void) {
  onActivity?.();
  try {
    await fetch('/api/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    });
  } catch {
    /* the next event will retry */
  }
}

export function LiveViewport({
  frame,
  frameCount,
  connected,
  screencasting,
  size,
  lastActivityAt,
  controlMode,
  onToggleControl,
  onActivity,
  onHide,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastMoveAt = useRef(0);
  const [rendered, setRendered] = useState(false);
  const [sleeping, setSleeping] = useState(false);

  const userControl = controlMode === 'user';

  useEffect(() => {
    if (userControl) {
      setSleeping(false);
      return;
    }
    if (Date.now() - lastActivityAt < IDLE_MS) setSleeping(false);
  }, [lastActivityAt, userControl]);

  useEffect(() => {
    if (userControl) {
      setSleeping(false);
      return;
    }
    const timer = setInterval(() => {
      setSleeping(Date.now() - lastActivityAt >= IDLE_MS);
    }, 5000);
    return () => clearInterval(timer);
  }, [lastActivityAt, userControl]);

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

  const pointFor = (element: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const width = frame?.metadata?.deviceWidth || size.width;
    const height = frame?.metadata?.deviceHeight || size.height;
    return {
      x: Math.round(((clientX - rect.left) / Math.max(rect.width, 1)) * width),
      y: Math.round(((clientY - rect.top) / Math.max(rect.height, 1)) * height),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!userControl) return;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    void inject({ type: 'input_mouse', eventType: 'mousePressed', ...pointFor(event.currentTarget, event.clientX, event.clientY), button: 'left', clickCount: 1 }, onActivity);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!userControl) return;
    const now = Date.now();
    if (now - lastMoveAt.current < 30) return;
    lastMoveAt.current = now;
    void inject({ type: 'input_mouse', eventType: 'mouseMoved', ...pointFor(event.currentTarget, event.clientX, event.clientY) }, onActivity);
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!userControl) return;
    void inject({ type: 'input_mouse', eventType: 'mouseReleased', ...pointFor(event.currentTarget, event.clientX, event.clientY), button: 'left' }, onActivity);
  };

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    if (!userControl) return;
    event.preventDefault();
    void inject({ type: 'input_mouse', eventType: 'mouseWheel', ...pointFor(event.currentTarget, event.clientX, event.clientY), deltaX: event.deltaX, deltaY: event.deltaY }, onActivity);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!userControl) return;
    const base: Record<string, unknown> = { type: 'input_keyboard', key: event.key, code: event.code };
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      base.modifiers = (event.ctrlKey || event.metaKey ? 2 : 0) | (event.altKey ? 1 : 0) | (event.shiftKey ? 8 : 0);
    }
    void inject({ ...base, eventType: 'keyDown' }, onActivity);
    if (event.key.length === 1) void inject({ type: 'input_keyboard', eventType: 'char', text: event.key }, onActivity);
  };

  const onKeyUp = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!userControl) return;
    void inject({ type: 'input_keyboard', eventType: 'keyUp', key: event.key, code: event.code }, onActivity);
  };

  const live = connected && screencasting && !sleeping;

  return (
    <Card variant="default" padding={0} height="100%" style={fill}>
      <style>{SLEEP_CSS}</style>
      <VStack gap={0} style={fill}>
        <HStack gap={3} vAlign="center" width="100%" padding={3}>
          <Heading level={3}>Live Viewport</Heading>
          <StackItem size="fill" />
          <Badge variant={userControl ? 'blue' : sleeping ? 'neutral' : live ? 'green' : 'neutral'} label={userControl ? 'Your control' : sleeping ? 'Resting' : live ? 'Live' : 'Waiting'} />
          <Text type="supporting" color="secondary">
            {size.width}×{size.height} · {frameCount} frames
          </Text>
          <IconButton
            label={userControl ? 'Return control to Megha' : 'Take control of browser'}
            tooltip={userControl ? 'Return control to Megha' : 'Take control (solve a CAPTCHA, then hand back)'}
            size="sm"
            variant={userControl ? 'primary' : 'ghost'}
            icon={<Icon icon={HandRaisedIcon} size="sm" />}
            onClick={onToggleControl}
          />
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
          <canvas
            ref={canvasRef}
            style={{ ...canvasStyle, visibility: sleeping || !rendered ? 'hidden' : 'visible', cursor: userControl ? 'crosshair' : undefined }}
            aria-label="Live browser viewport"
            tabIndex={userControl ? 0 : -1}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
          />

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

          {userControl && (
            <VStack style={hintStyle} gap={0}>
              <Text weight="semibold">You control the browser</Text>
              <Text type="supporting" color="secondary">
                Click, type and scroll to solve the CAPTCHA, then tap the hand icon to let Megha continue.
              </Text>
            </VStack>
          )}
        </VStack>
      </VStack>
    </Card>
  );
}
