import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CalendarDays, Plus, Trash2, Pencil } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select, Checkbox, Textarea } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Loader';
import { toast } from '../../store/uiSlice';
import { holidayService } from '../../services/attendance.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';
import { formatDate } from '../../utils/format';

const emptyHoliday = { name: '', date: '', type: 'PUBLIC', description: '', isOptional: false };

const HolidaysPage = () => {
  const dispatch = useDispatch();
  const { hasRole } = useAuth();
  const canManage = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR);
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyHoliday);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHolidays(await holidayService.list({ year }));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, year]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const groups = {};
    holidays.forEach((holiday) => {
      const month = new Date(holiday.date).toLocaleDateString('en-IN', { month: 'long' });
      groups[month] = groups[month] || [];
      groups[month].push(holiday);
    });
    return groups;
  }, [holidays]);

  const open = (holiday) => {
    setEditing(holiday || null);
    setForm(
      holiday
        ? {
            name: holiday.name,
            date: new Date(holiday.date).toISOString().slice(0, 10),
            type: holiday.type,
            description: holiday.description || '',
            isOptional: holiday.isOptional,
          }
        : emptyHoliday,
    );
    setModal(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await holidayService.update(editing._id, form);
        dispatch(toast('Holiday updated'));
      } else {
        await holidayService.create(form);
        dispatch(toast('Holiday added'));
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
      await holidayService.remove(confirm._id);
      dispatch(toast('Holiday removed'));
      setConfirm(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Holiday calendar"
        description="Company holidays are excluded from leave day counting and payroll working days."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Holidays' }]}
        actions={
          <>
            <select className="field w-auto" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {[year - 1, year, year + 1].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            {canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => open(null)}>
                <Plus size={16} /> Add holiday
              </button>
            ) : null}
          </>
        }
      />

      {loading ? <PageLoader label="Loading holidays..." /> : null}

      {!loading && !holidays.length ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <CalendarDays size={26} className="text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">No holidays configured for {year}</p>
            <p className="mt-1 text-xs text-slate-500">Add public holidays so leave and payroll calculations stay accurate.</p>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(grouped).map(([month, items]) => (
          <Card key={month}>
            <CardHeader title={month} description={`${items.length} holiday(s)`} />
            <div className="divide-y divide-slate-100">
              {items.map((holiday) => (
                <div key={holiday._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{holiday.name}</p>
                    <p className="text-xs text-slate-500">{formatDate(holiday.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={holiday.isOptional ? 'bg-amber-50 text-amber-700' : 'bg-navy-50 text-navy-800'}>
                      {holiday.type}
                    </Badge>
                    {canManage ? (
                      <div className="flex gap-0.5">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(holiday)}>
                          <Pencil size={13} />
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirm(holiday)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit holiday' : 'Add holiday'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="submit" form="holiday-form" className="btn btn-primary" disabled={busy}>
              Save holiday
            </button>
          </>
        }
      >
        <form id="holiday-form" onSubmit={save} className="space-y-4">
          <Input label="Holiday name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: 'PUBLIC', label: 'Public holiday' },
              { value: 'RESTRICTED', label: 'Restricted holiday' },
              { value: 'COMPANY', label: 'Company holiday' },
              { value: 'OPTIONAL', label: 'Optional holiday' },
            ]}
          />
          <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Checkbox label="Optional holiday" checked={form.isOptional} onChange={(e) => setForm({ ...form, isOptional: e.target.checked })} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title="Remove holiday"
        message={`Remove ${confirm?.name} from the holiday calendar?`}
        confirmLabel="Remove"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default HolidaysPage;
