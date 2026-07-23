import { describe, expect, it } from 'vitest';
import { evaluateEpic10Gate } from './validate-epic-10-gate.mjs';

const readyEvidence = {
  minimumDays: 30,
  minimumVersions: 2,
  observationStartedAt: '2026-07-01T00:00:00.000Z',
  observedAt: '2026-07-31T00:00:00.000Z',
  compatibleVersions: [
    { version: 'release-1', firstSeenAt: '2026-07-01T00:00:00.000Z' },
    { version: 'release-2', firstSeenAt: '2026-07-15T00:00:00.000Z' },
  ],
  activeLegacyClients: 0,
  unobservedKnownClients: 0,
  clientsRequiringRecovery: 0,
  unresolvedRecoveryItems: 0,
  unresolvedQuarantineItems: 0,
};

describe('Epic 10 compatibility gate', () => {
  it('opens only when every durable observation is satisfied', () => {
    expect(evaluateEpic10Gate(readyEvidence)).toMatchObject({
      passed: true,
      distinctVersions: 2,
      observationDays: 30,
    });
  });

  it('blocks an incomplete or too recent observation window', () => {
    const result = evaluateEpic10Gate({
      ...readyEvidence,
      observedAt: '2026-07-20T00:00:00.000Z',
      compatibleVersions: [readyEvidence.compatibleVersions[0]],
      activeLegacyClients: null,
      clientsRequiringRecovery: 1,
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(4);
  });
});
