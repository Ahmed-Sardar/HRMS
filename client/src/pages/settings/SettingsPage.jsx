import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Building2, Clock, Home, Landmark, Save, ShieldCheck, Wallet } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input, Select, Checkbox, FormGrid, Textarea } from '../../components/ui/Field';
import { toast } from '../../store/uiSlice';
import { settingsService } from '../../services/settings.service';
import { getErrorMessage } from '../../services/api';
import { ROLES, formatEnum } from '../../utils/constants';

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const SettingsPage = () => {
  const dispatch = useDispatch();
  const [form, setForm] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, roleList] = await Promise.all([settingsService.get(), settingsService.roles().catch(() => [])]);
      setForm({
        companyName: settings.companyName || '',
        legalName: settings.legalName || '',
        email: settings.email || '',
        phone: settings.phone || '',
        website: settings.website || '',
        address: settings.address || '',
        timezone: settings.timezone || 'Asia/Kolkata',
        currency: settings.currency || 'INR',
        currencySymbol: settings.currencySymbol || '₹',
        workingDays: settings.workingDays || [1, 2, 3, 4, 5],
        workStartTime: settings.workStartTime || '09:00',
        workEndTime: settings.workEndTime || '18:00',
        gracePeriodMinutes: settings.gracePeriodMinutes ?? 15,
        fullDayMinutes: settings.fullDayMinutes ?? 480,
        halfDayMinutes: settings.halfDayMinutes ?? 240,
        overtimeMultiplier: settings.overtimeMultiplier ?? 1.5,
        weekendOvertimeMultiplier: settings.weekendOvertimeMultiplier ?? 2,
        payrollDay: settings.payrollDay ?? 1,
        probationMonths: settings.probationMonths ?? 3,
        noticePeriodDays: settings.noticePeriodDays ?? 30,
        fiscalYearStartMonth: settings.fiscalYearStartMonth ?? 4,
        attendanceCorrectionWindowDays: settings.attendanceCorrectionWindowDays ?? 7,
        wfhMonthlyLimit: settings.wfhMonthlyLimit ?? 8,
        wfhRequiresHrApproval: settings.wfhRequiresHrApproval !== false,
        wfhMaxAdvanceDays: settings.wfhMaxAdvanceDays ?? 45,
        wfhPolicyNotes: settings.wfhPolicyNotes || '',
        enableEmailNotifications: Boolean(settings.enableEmailNotifications),
        statutory: {
          pfEnabled: Boolean(settings.statutory?.pfEnabled),
          pfEmployeePercent: settings.statutory?.pfEmployeePercent ?? 12,
          pfEmployerPercent: settings.statutory?.pfEmployerPercent ?? 12,
          pfWageCeiling: settings.statutory?.pfWageCeiling ?? 15000,
          esiEnabled: Boolean(settings.statutory?.esiEnabled),
          esiEmployeePercent: settings.statutory?.esiEmployeePercent ?? 0.75,
          esiEmployerPercent: settings.statutory?.esiEmployerPercent ?? 3.25,
          esiWageCeiling: settings.statutory?.esiWageCeiling ?? 21000,
          ptEnabled: Boolean(settings.statutory?.ptEnabled),
          ptMonthlyAmount: settings.statutory?.ptMonthlyAmount ?? 200,
          tdsEnabled: Boolean(settings.statutory?.tdsEnabled),
          tdsPercent: settings.statutory?.tdsPercent ?? 0,
        },
        leaveTypes: settings.leaveTypes || [],
      });
      setRoles(roleList || []);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const toggleDay = (day) => {
    setForm((current) => ({
      ...current,
      workingDays: current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : [...current.workingDays, day].sort((a, b) => a - b),
    }));
  };

  const setStatutory = (key, value) =>
    setForm((current) => ({ ...current, statutory: { ...current.statutory, [key]: value } }));

  const updateLeaveType = (index, key, value) => {
    setForm((current) => ({
      ...current,
      leaveTypes: current.leaveTypes.map((item, position) => (position === index ? { ...item, [key]: value } : item)),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        gracePeriodMinutes: Number(form.gracePeriodMinutes),
        fullDayMinutes: Number(form.fullDayMinutes),
        halfDayMinutes: Number(form.halfDayMinutes),
        overtimeMultiplier: Number(form.overtimeMultiplier),
        weekendOvertimeMultiplier: Number(form.weekendOvertimeMultiplier),
        payrollDay: Number(form.payrollDay),
        probationMonths: Number(form.probationMonths),
        noticePeriodDays: Number(form.noticePeriodDays),
        fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
        attendanceCorrectionWindowDays: Number(form.attendanceCorrectionWindowDays),
        wfhMonthlyLimit: Number(form.wfhMonthlyLimit),
        wfhMaxAdvanceDays: Number(form.wfhMaxAdvanceDays),
        leaveTypes: form.leaveTypes.map((item) => ({ ...item, annualQuota: Number(item.annualQuota) || 0 })),
        statutory: {
          ...form.statutory,
          pfEmployeePercent: Number(form.statutory.pfEmployeePercent) || 0,
          pfEmployerPercent: Number(form.statutory.pfEmployerPercent) || 0,
          pfWageCeiling: Number(form.statutory.pfWageCeiling) || 0,
          esiEmployeePercent: Number(form.statutory.esiEmployeePercent) || 0,
          esiEmployerPercent: Number(form.statutory.esiEmployerPercent) || 0,
          esiWageCeiling: Number(form.statutory.esiWageCeiling) || 0,
          ptMonthlyAmount: Number(form.statutory.ptMonthlyAmount) || 0,
          tdsPercent: Number(form.statutory.tdsPercent) || 0,
        },
      };
      const updated = await settingsService.update(payload);
      dispatch(toast('Company settings saved'));
      if (updated?.companyName) set('companyName', updated.companyName);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !form) {
    return <Card className="p-6 text-sm text-slate-500">Loading settings...</Card>;
  }

  return (
    <div>
      <PageHeader
        title="Company settings"
        description="Company profile, attendance policy, payroll rules and role permissions."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Settings' }]}
        actions={
          <button type="submit" form="settings-form" className="btn btn-primary" disabled={busy}>
            <Save size={15} /> Save settings
          </button>
        }
      />

      <form id="settings-form" onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader title="Company profile" description="Shown on payslips, exports and emails" actions={<Building2 size={16} className="text-slate-400" />} />
          <div className="p-5">
            <FormGrid columns={3}>
              <Input label="Company name" required value={form.companyName} onChange={(event) => set('companyName', event.target.value)} />
              <Input label="Legal name" value={form.legalName} onChange={(event) => set('legalName', event.target.value)} />
              <Input label="Contact email" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} />
              <Input label="Phone" value={form.phone} onChange={(event) => set('phone', event.target.value)} />
              <Input label="Website" value={form.website} onChange={(event) => set('website', event.target.value)} />
              <Input label="Timezone" value={form.timezone} onChange={(event) => set('timezone', event.target.value)} />
              <Input label="Currency" value={form.currency} onChange={(event) => set('currency', event.target.value)} />
              <Input label="Currency symbol" value={form.currencySymbol} onChange={(event) => set('currencySymbol', event.target.value)} />
              <Input label="Address" value={form.address} onChange={(event) => set('address', event.target.value)} />
            </FormGrid>
          </div>
        </Card>

        <Card>
          <CardHeader title="Attendance & working hours" description="Applied to all attendance and payroll calculations" actions={<Clock size={16} className="text-slate-400" />} />
          <div className="p-5">
            <FormGrid columns={3}>
              <Input label="Work start time" type="time" value={form.workStartTime} onChange={(event) => set('workStartTime', event.target.value)} />
              <Input label="Work end time" type="time" value={form.workEndTime} onChange={(event) => set('workEndTime', event.target.value)} />
              <Input label="Grace period (minutes)" type="number" min="0" value={form.gracePeriodMinutes} onChange={(event) => set('gracePeriodMinutes', event.target.value)} />
              <Input label="Full day (minutes)" type="number" min="60" value={form.fullDayMinutes} onChange={(event) => set('fullDayMinutes', event.target.value)} />
              <Input label="Half day (minutes)" type="number" min="30" value={form.halfDayMinutes} onChange={(event) => set('halfDayMinutes', event.target.value)} />
              <Input label="Correction window (days)" type="number" min="1" value={form.attendanceCorrectionWindowDays} onChange={(event) => set('attendanceCorrectionWindowDays', event.target.value)} />
            </FormGrid>
            <div className="mt-4">
              <p className="label">Working days</p>
              <div className="flex flex-wrap gap-4">
                {WEEKDAYS.map((day) => (
                  <Checkbox key={day.value} label={day.label} checked={form.workingDays.includes(day.value)} onChange={() => toggleDay(day.value)} />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payroll & policy" description="Defaults used by payroll and employment workflows" actions={<Wallet size={16} className="text-slate-400" />} />
          <div className="p-5">
            <FormGrid columns={3}>
              <Input label="Payroll day" type="number" min="1" max="31" value={form.payrollDay} onChange={(event) => set('payrollDay', event.target.value)} />
              <Input label="Overtime multiplier" type="number" min="1" max="3" step="0.1" value={form.overtimeMultiplier} onChange={(event) => set('overtimeMultiplier', event.target.value)} />
              <Input label="Weekend OT multiplier" type="number" min="1" max="3" step="0.1" value={form.weekendOvertimeMultiplier} onChange={(event) => set('weekendOvertimeMultiplier', event.target.value)} />
              <Input label="Probation (months)" type="number" min="0" value={form.probationMonths} onChange={(event) => set('probationMonths', event.target.value)} />
              <Input label="Notice period (days)" type="number" min="0" value={form.noticePeriodDays} onChange={(event) => set('noticePeriodDays', event.target.value)} />
              <Select
                label="Fiscal year starts"
                value={form.fiscalYearStartMonth}
                onChange={(event) => set('fiscalYearStartMonth', event.target.value)}
                options={Array.from({ length: 12 }, (_, index) => ({
                  value: index + 1,
                  label: new Date(2024, index, 1).toLocaleDateString('en-IN', { month: 'long' }),
                }))}
              />
            </FormGrid>
            <div className="mt-4">
              <Checkbox
                label="Send email notifications (leave, payroll, documents)"
                checked={form.enableEmailNotifications}
                onChange={(event) => set('enableEmailNotifications', event.target.checked)}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Statutory deductions"
            description="Optional payroll deductions, fully configurable and disabled until you enable them"
            actions={<Landmark size={16} className="text-slate-400" />}
          />
          <div className="space-y-5 p-5">
            <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
              The platform does not assume any country&apos;s statutory rules. Enter the rates and ceilings that apply to
              your company and confirm them with your payroll advisor. Deductions appear on payroll and payslips as soon
              as a component is enabled.
            </p>

            <div>
              <Checkbox
                label="Provident fund (PF) — calculated on basic salary"
                checked={form.statutory.pfEnabled}
                onChange={(event) => setStatutory('pfEnabled', event.target.checked)}
              />
              <div className="mt-3">
                <FormGrid columns={3}>
                  <Input
                    label="Employee %"
                    type="number"
                    min="0"
                    max="25"
                    step="0.01"
                    disabled={!form.statutory.pfEnabled}
                    value={form.statutory.pfEmployeePercent}
                    onChange={(event) => setStatutory('pfEmployeePercent', event.target.value)}
                  />
                  <Input
                    label="Employer %"
                    type="number"
                    min="0"
                    max="25"
                    step="0.01"
                    disabled={!form.statutory.pfEnabled}
                    value={form.statutory.pfEmployerPercent}
                    onChange={(event) => setStatutory('pfEmployerPercent', event.target.value)}
                  />
                  <Input
                    label="Monthly wage ceiling"
                    type="number"
                    min="0"
                    disabled={!form.statutory.pfEnabled}
                    hint="0 applies PF to the full basic salary"
                    value={form.statutory.pfWageCeiling}
                    onChange={(event) => setStatutory('pfWageCeiling', event.target.value)}
                  />
                </FormGrid>
              </div>
            </div>

            <div>
              <Checkbox
                label="Employee State Insurance (ESI) — calculated on gross earnings"
                checked={form.statutory.esiEnabled}
                onChange={(event) => setStatutory('esiEnabled', event.target.checked)}
              />
              <div className="mt-3">
                <FormGrid columns={3}>
                  <Input
                    label="Employee %"
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    disabled={!form.statutory.esiEnabled}
                    value={form.statutory.esiEmployeePercent}
                    onChange={(event) => setStatutory('esiEmployeePercent', event.target.value)}
                  />
                  <Input
                    label="Employer %"
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    disabled={!form.statutory.esiEnabled}
                    value={form.statutory.esiEmployerPercent}
                    onChange={(event) => setStatutory('esiEmployerPercent', event.target.value)}
                  />
                  <Input
                    label="Monthly gross ceiling"
                    type="number"
                    min="0"
                    disabled={!form.statutory.esiEnabled}
                    hint="Employees earning above this are excluded"
                    value={form.statutory.esiWageCeiling}
                    onChange={(event) => setStatutory('esiWageCeiling', event.target.value)}
                  />
                </FormGrid>
              </div>
            </div>

            <div>
              <Checkbox
                label="Professional tax — flat monthly amount"
                checked={form.statutory.ptEnabled}
                onChange={(event) => setStatutory('ptEnabled', event.target.checked)}
              />
              <div className="mt-3 max-w-xs">
                <Input
                  label="Monthly amount"
                  type="number"
                  min="0"
                  max="20000"
                  disabled={!form.statutory.ptEnabled}
                  value={form.statutory.ptMonthlyAmount}
                  onChange={(event) => setStatutory('ptMonthlyAmount', event.target.value)}
                />
              </div>
            </div>

            <div>
              <Checkbox
                label="Income tax (TDS) — flat percentage of gross earnings"
                checked={form.statutory.tdsEnabled}
                onChange={(event) => setStatutory('tdsEnabled', event.target.checked)}
              />
              <div className="mt-3 max-w-xs">
                <Input
                  label="TDS %"
                  type="number"
                  min="0"
                  max="50"
                  step="0.01"
                  disabled={!form.statutory.tdsEnabled}
                  value={form.statutory.tdsPercent}
                  onChange={(event) => setStatutory('tdsPercent', event.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Work from home policy"
            description="Controls request limits, approval chain and the advice shown to employees"
            actions={<Home size={16} className="text-slate-400" />}
          />
          <div className="p-5">
            <FormGrid columns={3}>
              <Input
                label="Monthly limit (days)"
                type="number"
                min="0"
                value={form.wfhMonthlyLimit}
                onChange={(event) => set('wfhMonthlyLimit', event.target.value)}
                hint="0 removes the monthly cap"
              />
              <Input
                label="Maximum advance (days)"
                type="number"
                min="1"
                value={form.wfhMaxAdvanceDays}
                onChange={(event) => set('wfhMaxAdvanceDays', event.target.value)}
              />
              <Select
                label="HR approval"
                value={form.wfhRequiresHrApproval ? 'yes' : 'no'}
                onChange={(event) => set('wfhRequiresHrApproval', event.target.value === 'yes')}
                options={[
                  { value: 'yes', label: 'Manager then HR' },
                  { value: 'no', label: 'Manager only' },
                ]}
              />
            </FormGrid>
            <div className="mt-4">
              <Textarea
                label="Policy note shown to employees"
                rows={3}
                value={form.wfhPolicyNotes}
                onChange={(event) => set('wfhPolicyNotes', event.target.value)}
                placeholder="e.g. WFH is available for roles that can work remotely; keep at least one day of overlap with your team."
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Leave types" description="Annual quota and paid status per leave type" />
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Annual quota</th>
                  <th>Paid</th>
                  <th>Carry forward</th>
                </tr>
              </thead>
              <tbody>
                {form.leaveTypes.map((leave, index) => (
                  <tr key={leave.code}>
                    <td className="font-medium text-slate-800">{leave.code}</td>
                    <td>{leave.name}</td>
                    <td>
                      <input
                        className="field h-9 w-24 py-1"
                        type="number"
                        min="0"
                        value={leave.annualQuota}
                        onChange={(event) => updateLeaveType(index, 'annualQuota', event.target.value)}
                      />
                    </td>
                    <td>
                      <Checkbox checked={Boolean(leave.isPaid)} onChange={(event) => updateLeaveType(index, 'isPaid', event.target.checked)} />
                    </td>
                    <td>
                      <Checkbox checked={Boolean(leave.carryForward)} onChange={(event) => updateLeaveType(index, 'carryForward', event.target.checked)} />
                    </td>
                  </tr>
                ))}
                {!form.leaveTypes.length ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-slate-500">
                      No leave types configured.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Role permissions" description="Read-only matrix enforced by the API" actions={<ShieldCheck size={16} className="text-slate-400" />} />
          <div className="space-y-4 p-5">
            {roles.map((role) => (
              <div key={role.slug || role._id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-800">{role.name || formatEnum(role.slug)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(role.permissions || []).map((permission) => (
                    <span key={permission} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {permission}
                    </span>
                  ))}
                  {!(role.permissions || []).length ? <span className="text-xs text-slate-400">No permissions listed</span> : null}
                </div>
              </div>
            ))}
            {!roles.length ? <p className="text-sm text-slate-500">Role matrix is not available. Run the seed script.</p> : null}
            <p className="text-xs text-slate-500">
              Roles: {Object.values(ROLES).join(' · ')}. Role changes are managed from User accounts.
            </p>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default SettingsPage;
