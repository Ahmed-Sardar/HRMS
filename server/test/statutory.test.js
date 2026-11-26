const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStatutory, buildStatutoryDeductionLines, DEFAULT_STATUTORY } = require('../src/utils/statutory');

const settingsWith = (statutory) => ({ statutory: { ...DEFAULT_STATUTORY, ...statutory } });

test('statutory deductions are all zero until an administrator enables them', () => {
  const result = computeStatutory({ basic: 40000, grossMonthly: 60000, settings: {} });
  assert.equal(result.pfEmployee, 0);
  assert.equal(result.esiEmployee, 0);
  assert.equal(result.professionalTax, 0);
  assert.equal(result.tds, 0);
  assert.equal(result.employeeTotal, 0);
  assert.equal(result.employerTotal, 0);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(buildStatutoryDeductionLines(result), []);
});

test('provident fund is calculated on basic and respects the wage ceiling', () => {
  const capped = computeStatutory({
    basic: 30000,
    grossMonthly: 45000,
    settings: settingsWith({ pfEnabled: true, pfEmployeePercent: 12, pfEmployerPercent: 12, pfWageCeiling: 15000 }),
  });
  assert.equal(capped.pfEmployee, 1800);
  assert.equal(capped.pfEmployer, 1800);
  assert.equal(capped.employeeTotal, 1800);
  assert.equal(capped.employerTotal, 1800);

  const uncapped = computeStatutory({
    basic: 30000,
    grossMonthly: 45000,
    settings: settingsWith({ pfEnabled: true, pfWageCeiling: 0 }),
  });
  assert.equal(uncapped.pfEmployee, 3600);
});

test('provident fund rounds to two decimals', () => {
  const result = computeStatutory({
    basic: 12345.67,
    grossMonthly: 20000,
    settings: settingsWith({ pfEnabled: true, pfEmployeePercent: 12, pfEmployerPercent: 12, pfWageCeiling: 0 }),
  });
  assert.equal(result.pfEmployee, 1481.48);
  assert.equal(result.pfEmployer, 1481.48);
});

test('ESI applies up to the configured gross ceiling only', () => {
  const inside = computeStatutory({
    basic: 15000,
    grossMonthly: 20000,
    settings: settingsWith({ esiEnabled: true, esiEmployeePercent: 0.75, esiEmployerPercent: 3.25, esiWageCeiling: 21000 }),
  });
  assert.equal(inside.esiEmployee, 150);
  assert.equal(inside.esiEmployer, 650);

  const outside = computeStatutory({
    basic: 20000,
    grossMonthly: 25000,
    settings: settingsWith({ esiEnabled: true, esiWageCeiling: 21000 }),
  });
  assert.equal(outside.esiEmployee, 0);
  assert.equal(outside.esiEmployer, 0);
  assert.ok(!outside.applied.includes('ESI'));
});

test('professional tax and TDS use the configured amounts', () => {
  const result = computeStatutory({
    basic: 50000,
    grossMonthly: 80000,
    settings: settingsWith({ ptEnabled: true, ptMonthlyAmount: 200, tdsEnabled: true, tdsPercent: 10 }),
  });
  assert.equal(result.professionalTax, 200);
  assert.equal(result.tds, 8000);
  assert.equal(result.employeeTotal, 8200);
});

test('deduction lines contain only enabled, non-zero components', () => {
  const result = computeStatutory({
    basic: 20000,
    grossMonthly: 20000,
    settings: settingsWith({
      pfEnabled: true,
      pfWageCeiling: 15000,
      esiEnabled: true,
      esiWageCeiling: 21000,
      ptEnabled: true,
      tdsEnabled: false,
    }),
  });
  const lines = buildStatutoryDeductionLines(result);
  assert.deepEqual(lines, [
    { name: 'Provident Fund (employee)', amount: 1800 },
    { name: 'Employee State Insurance (employee)', amount: 150 },
    { name: 'Professional Tax', amount: 200 },
  ]);
  assert.equal(result.employeeTotal, 2150);
});

test('settings received as a document-like object are still read', () => {
  // Mongoose documents expose values through getters/toObject, not spreadable keys.
  const documentLike = {
    statutory: {
      toObject: () => ({ pfEnabled: true, pfEmployeePercent: 12, pfEmployerPercent: 12, pfWageCeiling: 15000 }),
    },
  };
  const result = computeStatutory({ basic: 30000, grossMonthly: 40000, settings: documentLike });
  assert.equal(result.pfEmployee, 1800);
  assert.equal(result.pfEmployer, 1800);
});

test('disabled components are ignored even when amounts are configured', () => {
  const result = computeStatutory({
    basic: 30000,
    grossMonthly: 30000,
    settings: settingsWith({ pfEnabled: false, esiEnabled: false, ptEnabled: false, tdsEnabled: false }),
  });
  assert.equal(result.employeeTotal, 0);
  assert.equal(result.employerTotal, 0);
});
