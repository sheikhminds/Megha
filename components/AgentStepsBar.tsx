'use client';

import { HStack, VStack, StackItem } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Badge } from '@astryxdesign/core/Badge';
import type { AgentStep } from '@/lib/types';

interface Props {
  steps: AgentStep[];
  frameData: string | null;
  onShowBrowser: () => void;
}

export function AgentStepsBar({ steps, frameData, onShowBrowser }: Props) {
  return (
    <VStack gap={1} width="100%">
      <Collapsible
        defaultIsOpen={false}
        trigger={
          <HStack gap={2} vAlign="center" width="100%">
            <img
              src={frameData || '/logo.png'}
              alt="Browser preview"
              style={{
                width: 'var(--spacing-10)',
                height: 'var(--spacing-8)',
                objectFit: 'cover',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                flexShrink: 0,
                display: 'block',
              }}
            />
            <VStack gap={0}>
              <Text weight="semibold">Browser preview</Text>
              <Text type="supporting" color="secondary">
                {steps.length} step{steps.length === 1 ? '' : 's'} · tap to expand
              </Text>
            </VStack>
          </HStack>
        }
      >
        <VStack gap={2} width="100%" padding={2}>
          <HStack gap={2} vAlign="center" width="100%">
            <Text weight="semibold">Agent steps</Text>
            <StackItem size="fill" />
            <Button label="Show full browser" size="sm" variant="secondary" onClick={onShowBrowser}>
              Show full browser
            </Button>
          </HStack>

          {steps.map((step, index) => (
            <HStack key={`${step.command}-${index}`} gap={2} vAlign="start" width="100%">
              <Badge variant={step.success ? 'success' : 'error'} label={step.success ? '✓' : '✗'} />
              <VStack gap={0} style={{ minWidth: 0 }}>
                <Text weight="semibold">{step.command}</Text>
                <Text type="supporting" color="secondary" maxLines={1}>{step.output}</Text>
              </VStack>
            </HStack>
          ))}
        </VStack>
      </Collapsible>
    </VStack>
  );
}
