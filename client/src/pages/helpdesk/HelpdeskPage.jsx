import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Download, FileSpreadsheet, LifeBuoy, MessageSquare, Plus, Send, Ticket as TicketIcon } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import StatCard from '../../components/ui/StatCard';
import { toast } from '../../store/uiSlice';
import { helpdeskService } from '../../services/helpdesk.service';
import { userService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from '../../utils/constants';
import { formatDateTime, relativeTime } from '../../utils/format';

const emptyTicket = { subject: '', description: '', category: 'HR', priority: 'NORMAL' };

const HelpdeskPage = () => {
  const dispatch = useDispatch();
  const { role, user } = useAuth();
  const isStaff = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(role);

  const [tab, setTab] = useState('my');
  const [mine, setMine] = useState({ items: [], pagination: null });
  const [queue, setQueue] = useState({ items: [], pagination: null });
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyTicket);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null);
  const [comment, setComment] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [resolution, setResolution] = useState('');

  const loadMine = useCallback(async () => {
    setLoading(true);
    try {
      setMine(await helpdeskService.my({ status: statusFilter || undefined, category: categoryFilter || undefined, page, limit: 15 }));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, statusFilter, categoryFilter]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [list, counts] = await Promise.all([
        helpdeskService.list({ status: statusFilter || undefined, category: categoryFilter || undefined, page, limit: 15 }),
        helpdeskService.stats(),
      ]);
      setQueue(list);
      setStats(counts);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, statusFilter, categoryFilter]);

  useEffect(() => {
    if (tab === 'queue' && isStaff) loadQueue();
    else loadMine();
  }, [tab, isStaff, loadMine, loadQueue]);

  useEffect(() => {
    if (['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      userService
        .list({ limit: 100 })
        .then((data) => setAssignees((data.items || []).map((item) => ({ value: item._id, label: `${item.name} · ${item.role}` }))))
        .catch(() => {});
    }
  }, [role]);

  const createTicket = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await helpdeskService.create(form);
      dispatch(toast('Ticket created'));
      setCreateOpen(false);
      setForm(emptyTicket);
      await loadMine();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const openTicket = async (id) => {
    try {
      setActive(await helpdeskService.get(id));
      setComment('');
      setResolution('');
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    try {
      const updated = await helpdeskService.comment(active._id, { message: comment.trim() });
      setActive(updated);
      setComment('');
      dispatch(toast('Reply added'));
      if (tab === 'queue' && isStaff) loadQueue();
      else loadMine();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const changeStatus = async (status) => {
    try {
      await helpdeskService.setStatus(active._id, { status, resolutionSummary: resolution || undefined });
      setActive(await helpdeskService.get(active._id));
      dispatch(toast('Ticket updated'));
      if (tab === 'queue' && isStaff) loadQueue();
      else loadMine();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const assignTo = async (assignedTo) => {
    try {
      await helpdeskService.assign(active._id, { assignedTo });
      setActive(await helpdeskService.get(active._id));
      dispatch(toast('Ticket assigned'));
      loadQueue();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const exportAs = async (format) => {
    try {
      await helpdeskService.export({ status: statusFilter || undefined, category: categoryFilter || undefined, format });
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const columns = [
    {
      key: 'ticket',
      header: 'Ticket',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.subject}</p>
          <p className="text-xs text-slate-500">
            {row.ticketNumber} · {TICKET_CATEGORY_LABELS[row.category] || row.category}
          </p>
        </div>
      ),
    },
    ...(isStaff && tab === 'queue'
      ? [
          {
            key: 'employee',
            header: 'Raised by',
            render: (row) => (
              <div className="text-sm">
                <p className="text-slate-700">
                  {row.employee?.firstName} {row.employee?.lastName}
                </p>
                <p className="text-xs text-slate-500">{row.employee?.department?.name || row.employee?.employeeId}</p>
              </div>
            ),
          },
        ]
      : []),
    { key: 'priority', header: 'Priority', render: (row) => <span className="text-sm font-medium">{TICKET_PRIORITY_LABELS[row.priority]}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} labels={TICKET_STATUS_LABELS} /> },
    {
      key: 'assignedTo',
      header: 'Owner',
      render: (row) => <span className="text-sm text-slate-600">{row.assignedTo?.name || 'Unassigned'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Raised',
      render: (row) => <span className="text-xs text-slate-500">{relativeTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTicket(row._id)}>
          Open
        </button>
      ),
    },
  ];

  const rows = tab === 'queue' && isStaff ? queue : mine;

  return (
    <div>
      <PageHeader
        title="Employee helpdesk"
        description="Raise HR, payroll, IT and attendance queries, and track them to resolution."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Helpdesk' }]}
        actions={
          <>
            {isStaff ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => exportAs('xlsx')}>
                  <FileSpreadsheet size={15} /> Excel
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => exportAs('csv')}>
                  <Download size={15} /> CSV
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> New ticket
            </button>
          </>
        }
      />

      {isStaff && stats ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open" value={stats.byStatus?.OPEN || 0} icon={TicketIcon} tone="amber" />
          <StatCard label="In progress" value={stats.byStatus?.IN_PROGRESS || 0} icon={LifeBuoy} tone="blue" />
          <StatCard label="Unassigned" value={stats.unassigned || 0} icon={MessageSquare} tone="violet" />
          <StatCard label="Past due" value={stats.overdue || 0} hint="SLA target breached" icon={TicketIcon} tone="red" />
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Tickets"
          description={isStaff ? 'Assign tickets, respond and resolve employee queries.' : 'Your queries and their current status.'}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="field w-auto"
                value={categoryFilter}
                onChange={(event) => {
                  setPage(1);
                  setCategoryFilter(event.target.value);
                }}
              >
                <option value="">All categories</option>
                {TICKET_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="field w-auto"
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
              >
                <option value="">All statuses</option>
                {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {isStaff ? (
          <div className="border-b border-white/70 px-4 py-3">
            <Tabs
              value={tab}
              onChange={(value) => {
                setTab(value);
                setPage(1);
              }}
              items={[
                { key: 'my', label: 'My tickets' },
                { key: 'queue', label: 'Support queue' },
              ]}
            />
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={rows.items || []}
          loading={loading}
          pagination={rows.pagination}
          onPageChange={setPage}
          emptyTitle="No tickets yet"
          emptyDescription="Raise a ticket for HR, payroll, attendance or IT help."
          emptyAction={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New ticket
            </button>
          }
        />
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Raise a ticket"
        description="HR and admin are notified immediately."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="ticket-form" className="btn btn-primary" disabled={busy}>
              Create ticket
            </button>
          </>
        }
      >
        <form id="ticket-form" onSubmit={createTicket} className="space-y-4">
          <Input
            label="Subject"
            required
            placeholder="Short summary of your query"
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              options={TICKET_CATEGORIES}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
              options={Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Textarea
            label="Describe the issue"
            required
            rows={5}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Include dates, amounts or screenshots references so the team can help faster"
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        size="lg"
        title={active ? `${active.ticketNumber} · ${active.subject}` : 'Ticket'}
        description={
          active ? `${TICKET_CATEGORY_LABELS[active.category]} · ${TICKET_PRIORITY_LABELS[active.priority]} priority · raised ${formatDateTime(active.createdAt)}` : ''
        }
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setActive(null)}>
            Close
          </button>
        }
      >
        {active ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={active.status} labels={TICKET_STATUS_LABELS} />
              <span className="chip">Owner: {active.assignedTo?.name || 'Unassigned'}</span>
              {active.dueAt ? <span className="chip">SLA: {formatDateTime(active.dueAt)}</span> : null}
            </div>

            <div className="rounded-xl border border-white/70 bg-white/60 p-4 text-sm leading-relaxed text-slate-700">
              {active.description}
            </div>

            {active.resolutionSummary ? (
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                <p className="font-semibold">Resolution</p>
                <p className="mt-1">{active.resolutionSummary}</p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Conversation</p>
              <div className="space-y-2">
                {(active.comments || []).length ? (
                  active.comments.map((item) => (
                    <div key={item._id} className="rounded-xl border border-white/70 bg-white/55 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-800">
                          {item.authorName || item.author?.name}{' '}
                          <span className="text-[11px] font-normal text-slate-400">{item.authorRole}</span>
                        </p>
                        <span className="text-[11px] text-slate-400">{relativeTime(item.at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-slate-600">{item.message}</p>
                      {item.isInternal ? <span className="chip mt-2 bg-amber-50 text-amber-700">Internal note</span> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No replies yet.</p>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="field"
                  placeholder="Write a reply..."
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      addComment();
                    }
                  }}
                />
                <button type="button" className="btn btn-primary" onClick={addComment} disabled={!comment.trim()}>
                  <Send size={14} /> Reply
                </button>
              </div>
            </div>

            {isStaff ? (
              <div className="space-y-3 rounded-xl border border-white/70 bg-white/55 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Support actions</p>
                {assignees.length ? (
                  <Select
                    label="Assign to"
                    placeholder="Choose an owner"
                    value={active.assignedTo?._id || ''}
                    onChange={(event) => assignTo(event.target.value)}
                    options={assignees}
                  />
                ) : (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => assignTo(user?.id || user?._id)}>
                    Assign to me
                  </button>
                )}
                <Textarea
                  label="Resolution summary"
                  rows={2}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  placeholder="Required when resolving the ticket"
                />
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={value === 'RESOLVED' ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm'}
                      onClick={() => changeStatus(value)}
                      disabled={active.status === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : active.status === 'RESOLVED' ? (
              <button type="button" className="btn btn-secondary" onClick={() => changeStatus('CLOSED')}>
                Close ticket
              </button>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default HelpdeskPage;
