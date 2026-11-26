const test = require('node:test');
const assert = require('node:assert/strict');
const { daysUntil, isWithinDays, isDue, completedYears, planCarryForward } = require('../src/modules/automation/automation.service');

const leaveTypes = [
  { code: 'EARNED', annualQuota: 15, carryForward: true, maxCarryForward: 5 },
  { code: 'CASUAL', annualQuota: 12, carryForward: true, maxCarryForward: 0 },
  { code: 'SICK', annualQuota: 10, carryForward: false, maxCarryForward: 0 },
];

test('only types with carry-forward enabled move unused days', () => {
  const plan = planCarryForward({
    leaveTypes,
    previousBalances: [
      { type: 'EARNED', allocated: 15, used: 4, pending: 1, carriedForward: 0 }, // 10 unused, capped at 5
      { type: 'CASUAL', allocated: 12, used: 2, pending: 0, carriedForward: 0 }, // 10 unused, no cap
      { type: 'SICK', allocated: 10, used: 0, pending: 0, carriedForward: 0 },
    ],
  });
  assert.deepEqual(plan, [
    { type: 'EARNED', allocated: 15, carriedForward: 5 },
    { type: 'CASUAL', allocated: 12, carriedForward: 10 },
    { type: 'SICK', allocated: 10, carriedForward: 0 },
  ]);
});

test('carry-forward never goes negative or counts pending leave as available', () => {
  const plan = planCarryForward({
    leaveTypes: [{ code: 'EARNED', annualQuota: 15, carryForward: true, maxCarryForward: 0 }],
    previousBalances: [{ type: 'EARNED', allocated: 10, used: 12, pending: 3, carriedForward: 0 }],
  });
  assert.deepEqual(plan, [{ type: 'EARNED', allocated: 15, carriedForward: 0 }]);
});

test('carry-forward includes days carried into the previous year', () => {
  const plan = planCarryForward({
    leaveTypes: [{ code: 'EARNED', annualQuota: 15, carryForward: true, maxCarryForward: 20 }],
    previousBalances: [{ type: 'EARNED', allocated: 5, used: 0, pending: 0, carriedForward: 4 }],
  });
  assert.equal(plan[0].carriedForward, 9);
});

test('a missing previous balance carries nothing but still allocates the quota', () => {
  const plan = planCarryForward({ leaveTypes, previousBalances: [] });
  assert.deepEqual(plan.map((item) => item.carriedForward), [0, 0, 0]);
  assert.deepEqual(plan.map((item) => item.allocated), [15, 12, 10]);
});

test('daysUntil counts calendar days in both directions', () => {
  const now = new Date('2026-11-22T10:00:00');
  assert.equal(daysUntil(new Date('2026-11-22T23:00:00'), now), 0);
  assert.equal(daysUntil(new Date('2026-11-23T09:00:00'), now), 1);
  assert.equal(daysUntil(new Date('2026-11-20T09:00:00'), now), -2);
});

test('isWithinDays only accepts the coming window', () => {
  const now = new Date('2026-11-22T10:00:00');
  assert.equal(isWithinDays(new Date('2026-11-22T18:00:00'), 7, now), true);
  assert.equal(isWithinDays(new Date('2026-11-29T09:00:00'), 7, now), true);
  assert.equal(isWithinDays(new Date('2026-11-30T09:00:00'), 7, now), false);
  assert.equal(isWithinDays(new Date('2026-11-21T09:00:00'), 7, now), false);
  assert.equal(isWithinDays(null, 7, now), false);
});

test('completedYears counts full anniversaries only', () => {
  const now = new Date('2026-11-22T10:00:00');
  assert.equal(completedYears(new Date('2025-11-22T09:00:00'), now), 1);
  assert.equal(completedYears(new Date('2025-11-23T09:00:00'), now), 0);
  assert.equal(completedYears(new Date('2020-01-15T09:00:00'), now), 6);
  assert.equal(completedYears(null, now), 0);
  assert.equal(completedYears(new Date('2027-01-01T09:00:00'), now), 0);
});

test('isDue respects the interval and first runs', () => {
  const now = new Date('2026-11-22T10:00:00');
  assert.equal(isDue({ lastRunAt: null, now, intervalMs: 1000 }), true);
  assert.equal(isDue({ lastRunAt: new Date('2026-11-22T09:59:30'), now, intervalMs: 60_000 }), false);
  assert.equal(isDue({ lastRunAt: new Date('2026-11-22T09:58:00'), now, intervalMs: 60_000 }), true);
});
