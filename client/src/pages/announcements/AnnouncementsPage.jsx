import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select, Textarea, Checkbox, FormGrid } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { toast } from '../../store/uiSlice';
import { announcementService } from '../../services/notification.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import { ROLES, ROLE_LABELS, formatEnum } from '../../utils/constants';
import { formatDate, formatDateTime } from '../../utils/format';

const emptyAnnouncement = {
  title: '',
  content: '',
  category: 'GENERAL',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE, ROLES.EMPLOYEE],
  priority: 'NORMAL',
  publishedAt: '',
  expiresAt: '',
  isPinned: false,
};

const priorityTone = {
  URGENT: 'bg-red-50 text-red-700',
  HIGH: 'bg-amber-50 text-amber-700',
  NORMAL: 'bg-blue-50 text-blue-700',
  LOW: 'bg-slate-100 text-slate-600',
};

const AnnouncementsPage = () => {
  const dispatch = useDispatch();
  const { hasRole } = useAuth();
  const canManage = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR);

  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAnnouncement);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [manageMode, setManageMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = canManage && manageMode
        ? await announcementService.manage({ limit: 50 })
        : await announcementService.list({ limit: 50 });
      setData(result);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [canManage, dispatch, manageMode]);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (announcement) => {
    setEditing(announcement || null);
    setForm(
      announcement
        ? {
            title: announcement.title,
            content: announcement.content,
            category: announcement.category || 'GENERAL',
            roles: announcement.roles?.length ? announcement.roles : emptyAnnouncement.roles,
            priority: announcement.priority || 'NORMAL',
            publishedAt: announcement.publishedAt ? new Date(announcement.publishedAt).toISOString().slice(0, 16) : '',
            expiresAt: announcement.expiresAt ? new Date(announcement.expiresAt).toISOString().slice(0, 16) : '',
            isPinned: Boolean(announcement.isPinned),
          }
        : emptyAnnouncement,
    );
    setModal(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        publishedAt: form.publishedAt || undefined,
        expiresAt: form.expiresAt || undefined,
      };
      if (editing) await announcementService.update(editing._id, payload);
      else await announcementService.create(payload);
      dispatch(toast(editing ? 'Announcement updated' : 'Announcement published'));
      setModal(false);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    setBusy(true);
    try {
      await announcementService.remove(confirmArchive._id);
      dispatch(toast('Announcement archived'));
      setConfirmArchive(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = (role) => {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role],
    }));
  };

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Company-wide updates, policies and events targeted to specific roles."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Announcements' }]}
        actions={
          <>
            {canManage ? (
              <button type="button" className="btn btn-secondary" onClick={() => setManageMode((value) => !value)}>
                {manageMode ? 'Show published' : 'Manage all'}
              </button>
            ) : null}
            {canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
                <Plus size={16} /> New announcement
              </button>
            ) : null}
          </>
        }
      />

      {loading ? (
        <Card className="p-6 text-sm text-slate-500">Loading announcements...</Card>
      ) : data.items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((item) => (
            <Card key={item._id} className={item.isPinned ? 'border-navy-200' : undefined}>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {item.isPinned ? (
                      <Badge tone="bg-navy-50 text-navy-800">
                        <Pin size={11} /> Pinned
                      </Badge>
                    ) : null}
                    <Badge tone={priorityTone[item.priority] || priorityTone.NORMAL}>{formatEnum(item.priority)}</Badge>
                    <Badge>{formatEnum(item.category)}</Badge>
                    {item.isActive === false ? <Badge tone="bg-slate-100 text-slate-500">Archived</Badge> : null}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.createdBy?.name || 'HR'} · {formatDateTime(item.publishedAt || item.createdAt)}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openForm(item)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirmArchive(item)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="whitespace-pre-line px-5 py-4 text-sm text-slate-600">{item.content}</div>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                <span>Audience: {(item.roles || []).map((role) => ROLE_LABELS[role] || role).join(', ') || 'Everyone'}</span>
                {item.expiresAt ? <span>· Expires {formatDate(item.expiresAt)}</span> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No announcements"
            description="Company announcements published by HR will appear here."
            action={
              canManage ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openForm(null)}>
                  <Plus size={14} /> Publish announcement
                </button>
              ) : null
            }
          />
        </Card>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit announcement' : 'New announcement'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="submit" form="announcement-form" className="btn btn-primary" disabled={busy}>
              {editing ? 'Save changes' : 'Publish'}
            </button>
          </>
        }
      >
        <form id="announcement-form" onSubmit={save} className="space-y-4">
          <Input label="Title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <Textarea label="Content" required rows={6} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          <FormGrid columns={2}>
            <Select
              label="Category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              options={['GENERAL', 'HR', 'POLICY', 'EVENT', 'FINANCE', 'SYSTEM'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
              options={['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((value) => ({ value, label: formatEnum(value) }))}
            />
            <Input label="Publish at" type="datetime-local" value={form.publishedAt} onChange={(event) => setForm({ ...form, publishedAt: event.target.value })} />
            <Input label="Expires at" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
          </FormGrid>
          <div>
            <p className="label">Audience</p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <Checkbox key={role} label={label} checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />
              ))}
            </div>
          </div>
          <Checkbox label="Pin to top" checked={form.isPinned} onChange={(event) => setForm({ ...form, isPinned: event.target.checked })} />
          <p className="text-xs text-slate-500">Announcements notify the selected roles and appear on their dashboard.</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmArchive)}
        onClose={() => setConfirmArchive(null)}
        onConfirm={archive}
        title="Archive announcement"
        message={`Archive '${confirmArchive?.title || ''}'? It will no longer be visible to employees.`}
        confirmLabel="Archive"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default AnnouncementsPage;
