/** Persisted room contract. Bump version when eligibility/selection semantics change.
 * Numeric changes also alter the save fingerprint automatically. No combat RNG is shared.
 */
export const roomRules = Object.freeze({
  version: 'sector-rooms-2', cards: 3, artifacts: 2, replacementCandidates: 4, replacements: 3,
  upgradeHealth: 3, riskHealth: 2, riskChance: 0.7,
  outcome: 'scoped-fnv-seed-mulberry32-first',
  replacementFilter: 'reward-not-excluded-same-class-not-original-ordinary-v1',
  rewardFilter: 'reward-not-excluded-ordinary-v1',
  artifactFilter: 'not-already-owned-v1',
  eventEligibility: 'unupgraded-copies-v1',
  emptyPool: 'shorten-offers-disable-empty-action-v1',
})
