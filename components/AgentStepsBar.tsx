'use client';

import { useState } from 'react';
import { HStack, VStack, StackItem } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import type { AgentStep } from '@/lib/types';

interface Props {
  steps: AgentStep[];
}

export function AgentStepsBar({ steps }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <VStack gap={2} padding={2} width="100%">
      <HStack gap={2} vAlign="center" width="100%">
        <Text weight="semibold">Agent steps</Text>
        <Badge variant="neutral" label={String(steps.length)} />
        <StackItem size="fill" />
        <Button
          label={expanded ? 'Collapse agent steps' : 'Expand agent steps'}
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </HStack>

      {expanded && (
        <VStack gap={1} width="100%">
          {steps.length === 0 && (
            <Text type="supporting" color="secondary">No steps yet — ask Megha to do something.</Text>
          )}
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
      )}
    </VStack>
  );
}
