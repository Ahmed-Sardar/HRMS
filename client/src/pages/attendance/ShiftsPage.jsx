import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Checkbox } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { shiftService } from '../../services/attendance.service';
import { getErrorMessage } from '../../services/api';

const weekDays = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const emptyShift = {
  name: '',
  code: '',
  startTime: '09:00',
  endTime: '18:00',
  graceMinutes: 15,
  breakMinutes: 60,
  weeklyOffs: [0, 6],
  isDefault: false,
  isActive: true,
};

const ShiftsPage = () => {
  const dispatch = useDispatch();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyShift);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShifts(await shiftService.list());
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (shift) => {
    setEditing(shift || null);
    setForm(
      shift
        ? {
            name: shift.name,
            code: shift.code,
            startTime: shift.startTime,
            endTime: shift.endTime,
            graceMinutes: shift.graceMinutes,
            breakMinutes: shift.breakMinutes,
            weeklyOffs: shift.weeklyOffs || [],
            isDefault: shift.isDefault,
            isActive: shift.isActive,
          }
        : emptyShift,
    );
    setModal(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await shiftService.update(editing._id, form);
        dispatch(toast('Shift updated'));
      } else {
        await shiftService.create(form);
        dispatch(toast('Shift created'));
      }
      setModal(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await shiftService.remove(confirm._id);
      dispatch(toast('Shift deactivated'));
      setConfirm(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const toggleOff = (day) => {
    setForm((prev) => ({
      ...prev,
      weeklyOffs: prev.weeklyOffs.includes(day)
        ? prev.weeklyOffs.filter((item) => item !== day)
        : [...prev.weeklyOffs, day],
    }));
  };

  const columns = [
    {
      key: 'name',
      header: 'Shift',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">{row.code}</p>
        </div>
      ),
    },
    {
      key: 'timing',
      header: 'Timing',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Clock size={14} className="text-slate-400" /> {row.startTime} - {row.endTime}
        </span>
      ),
    },
    { key: 'graceMinutes', header: 'Grace', render: (row) => `${row.graceMinutes} min` },
    { key: 'breakMinutes', header: 'Break', render: (row) => `${row.breakMinutes} min` },
    {
      key: 'weeklyOffs',
      header: 'Weekly offs',
      render: (row) => (row.weeklyOffs || []).map((day) => weekDays.find((item) => item.value === day)?.label).join(', ') || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex gap-1">
          {row.isDefault ? <Badge tone="bg-navy-50 text-navy-800">Default</Badge> : null}
          <Badge tone={row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(row)}>
            <Pencil size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirm(row)}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Shift management"
        description="Define working hours, grace periods and weekly offs. Attendance calculations use the assigned shift."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Shifts' }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => open(null)}>
            <Plus size={16} /> Add shift
          </button>
        }
      />

      <Card>
        <CardHeader title="Shifts" description={`${shifts.length} configured shifts`} />
        <DataTable
          columns={columns}
          rows={shifts}
          loading={loading}
          emptyTitle="No shifts configured"
          emptyDescription="Create a shift so attendance can be calculated against working hours."
        />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit shift' : 'New shift'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="submit" form="shift-form" className="btn btn-primary" disabled={busy}>
              Save shift
            </button>
          </>
        }
      >
        <form id="shift-form" onSubmit={save} className="space-y-4">
          <Input label="Shift name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Start time" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="End time" type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            <Input label="Grace period (minutes)" type="number" min="0" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: Number(e.target.value) })} />
            <Input label="Break duration (minutes)" type="number" min="0" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: Number(e.target.value) })} />
          </div>
          <div>
            <p className="label">Weekly offs</p>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleOff(day.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    form.weeklyOffs.includes(day.value)
                      ? 'border-navy-800 bg-navy-800 text-white'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Checkbox
              label="Set as default shift"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            <Checkbox
              label="Shift is active"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title="Deactivate shift"
        message={`Deactivate ${confirm?.name}? Employees must be reassigned before removal.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default ShiftsPage;
