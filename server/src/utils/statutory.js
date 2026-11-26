/**
 * Statutory deduction engine.
 *
 * The platform does not hard-code any country's labour law. Every rate, ceiling
 * and amount is configured by the company in Settings → Statutory deductions and
 * is disabled by default, so payroll output stays exactly the same until an
 * administrator opts in. These helpers are pure functions so they can be unit
 * tested without a database.
 */

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const percentOf = (amount, percent) => round2(((Number(amount) || 0) * (Number(percent) || 0)) / 100);

const DEFAULT_STATUTORY = Object.freeze({
  pfEnabled: false,
  pfEmployeePercent: 12,
  pfEmployerPercent: 12,
  pfWageCeiling: 15000,
  esiEnabled: false,
  esiEmployeePercent: 0.75,
  esiEmployerPercent: 3.25,
  esiWageCeiling: 21000,
  ptEnabled: false,
  ptMonthlyAmount: 200,
  tdsEnabled: false,
  tdsPercent: 0,
});

const LINE_LABELS = {
  pfEmployee: 'Provident Fund (employee)',
  esiEmployee: 'Employee State Insurance (employee)',
  professionalTax: 'Professional Tax',
  tds: 'Income Tax (TDS)',
};

/**
 * Computes employee and employer statutory contributions for one payroll month.
 * Amounts are monthly and already rounded to 2 decimals.
 */
const toPlainConfig = (settings) => {
  const raw = settings && settings.statutory;
  if (!raw) return {};
  // Settings can arrive as a Mongoose document/subdocument. Spreading those
  // objects drops schema paths, so convert with toObject first.
  return typeof raw.toObject === 'function' ? raw.toObject() : raw;
};

const computeStatutory = ({ basic = 0, grossMonthly = 0, settings } = {}) => {
  const config = { ...DEFAULT_STATUTORY, ...toPlainConfig(settings) };
  const result = {
    pfEmployee: 0,
    pfEmployer: 0,
    esiEmployee: 0,
    esiEmployer: 0,
    professionalTax: 0,
    tds: 0,
    employeeTotal: 0,
    employerTotal: 0,
    applied: [],
  };

  if (config.pfEnabled) {
    const ceiling = Number(config.pfWageCeiling) || 0;
    const wageBase = ceiling > 0 ? Math.min(Number(basic) || 0, ceiling) : Number(basic) || 0;
    result.pfEmployee = percentOf(wageBase, config.pfEmployeePercent);
    result.pfEmployer = percentOf(wageBase, config.pfEmployerPercent);
    result.applied.push('PF');
  }

  if (config.esiEnabled) {
    const ceiling = Number(config.esiWageCeiling) || 0;
    const gross = Number(grossMonthly) || 0;
    // A ceiling of 0 means "cover everyone". Above the ceiling the employee is
    // outside the scheme for that month.
    if (!ceiling || gross <= ceiling) {
      result.esiEmployee = percentOf(gross, config.esiEmployeePercent);
      result.esiEmployer = percentOf(gross, config.esiEmployerPercent);
      result.applied.push('ESI');
    }
  }

  if (config.ptEnabled) {
    result.professionalTax = round2(config.ptMonthlyAmount);
    result.applied.push('PT');
  }

  if (config.tdsEnabled) {
    result.tds = percentOf(grossMonthly, config.tdsPercent);
    result.applied.push('TDS');
  }

  result.employeeTotal = round2(
    result.pfEmployee + result.esiEmployee + result.professionalTax + result.tds,
  );
  result.employerTotal = round2(result.pfEmployer + result.esiEmployer);
  return result;
};

/** Turns computed statutory amounts into payroll deduction lines (non-zero only). */
const buildStatutoryDeductionLines = (statutory) => {
  if (!statutory) return [];
  return Object.keys(LINE_LABELS)
    .map((key) => ({ name: LINE_LABELS[key], amount: round2(statutory[key]) }))
    .filter((line) => line.amount > 0);
};

module.exports = {
  DEFAULT_STATUTORY,
  computeStatutory,
  buildStatutoryDeductionLines,
  round2,
};
