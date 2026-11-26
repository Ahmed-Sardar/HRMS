import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AlertTriangle, Download, FileText, ShieldCheck, Trash2, Upload } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { documentService } from '../../services/document.service';
import { employeeService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';
import { DOCUMENT_CATEGORIES, ROLES, formatEnum } from '../../utils/constants';
import { formatDate, fileSize } from '../../utils/format';

const DocumentsPage = () => {
  const dispatch = useDispatch();
  const { hasRole } = useAuth();
  const isStaff = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR);

  const [data, setData] = useState({ items: [], pagination: null });
  const [expiring, setExpiring] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ search: '', category: '', status: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState(false);
  const [form, setForm] = useState({ employee: '', title: '', category: 'IDENTITY', issueDate: '', expiryDate: '' });
  const [file, setFile] = useState(null);
  const [verifyModal, setVerifyModal] = useState(null);
  const [verifyForm, setVerifyForm] = useState({ status: 'VERIFIED', verificationComment: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await documentService.list({ ...filters, page, limit: 25 });
      setData(result);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isStaff) {
      documentService.expiring(60).then(setExpiring).catch(() => {});
      employeeService.options().then(setEmployees).catch(() => {});
    }
  }, [isStaff]);

  const upload = async (event) => {
    event.preventDefault();
    if (!file) {
      dispatch(toast('Please choose a file', 'error'));
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('category', form.category);
      if (isStaff && form.employee) formData.append('employee', form.employee);
      if (form.issueDate) formData.append('issueDate', form.issueDate);
      if (form.expiryDate) formData.append('expiryDate', form.expiryDate);
      formData.append('file', file);
      await documentService.upload(formData);
      dispatch(toast('Document uploaded'));
      setUploadModal(false);
      setForm({ employee: '', title: '', category: 'IDENTITY', issueDate: '', expiryDate: '' });
      setFile(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await documentService.verify(verifyModal._id, verifyForm);
      dispatch(toast(`Document ${verifyForm.status.toLowerCase()}`));
      setVerifyModal(null);
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
      await documentService.remove(confirmDelete._id);
      dispatch(toast('Document deleted'));
      setConfirmDelete(null);
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setBusy(false);
    }
  };

  const download = async (row) => {
    try {
      await documentService.download(row._id);
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const columns = [
    ...(isStaff
      ? [
          {
            key: 'employee',
            header: 'Employee',
            render: (row) => (
              <div>
                <p className="font-medium text-slate-900">
                  {row.employee?.firstName} {row.employee?.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {row.employee?.employeeId} · {row.employee?.department?.name || '—'}
                </p>
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'title',
      header: 'Document',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-500">
            {formatEnum(row.category)} · {fileSize(row.size)} · uploaded {formatDate(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'expiry',
      header: 'Expiry',
      render: (row) =>
        row.expiryDate ? (
          <span className={new Date(row.expiryDate) < new Date() ? 'text-xs font-medium text-red-600' : 'text-xs text-slate-600'}>
            {formatDate(row.expiryDate)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">No expiry</span>
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'verified',
      header: 'Verified by',
      render: (row) => <span className="text-xs text-slate-500">{row.verifiedBy?.name || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => download(row)}>
            <Download size={13} /> Download
          </button>
          {isStaff ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setVerifyModal(row);
                setVerifyForm({ status: 'VERIFIED', verificationComment: '' });
              }}
            >
              <ShieldCheck size={14} />
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setConfirmDelete(row)}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={isStaff ? 'Employee documents' : 'My documents'}
        description={isStaff ? 'Upload, verify and track employee documents and expiry dates.' : 'Your HR documents. Upload required documents and download copies anytime.'}
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Documents' }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setUploadModal(true)}>
            <Upload size={16} /> Upload document
          </button>
        }
      />

      {isStaff && expiring.length ? (
        <Card className="mb-4 border-amber-200">
          <CardHeader
            title="Documents expiring soon"
            description={`${expiring.length} document(s) expire within 60 days`}
            actions={<span className="chip bg-amber-50 text-amber-700"><AlertTriangle size={13} /> Action needed</span>}
          />
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {expiring.slice(0, 6).map((item) => (
              <div key={item._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.employee?.firstName} {item.employee?.lastName} · expires {formatDate(item.expiryDate)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-4">
          {isStaff ? (
            <input
              className="field"
              placeholder="Search by document title"
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, search: event.target.value });
              }}
            />
          ) : (
            <p className="text-sm text-slate-600">Showing your documents</p>
          )}
          <Select
            placeholder="All categories"
            value={filters.category}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, category: event.target.value });
            }}
            options={DOCUMENT_CATEGORIES}
          />
          {isStaff ? (
            <Select
              placeholder="All statuses"
              value={filters.status}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, status: event.target.value });
              }}
              options={[
                { value: 'PENDING', label: 'Pending' },
                { value: 'VERIFIED', label: 'Verified' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
            />
          ) : null}
          <p className="flex items-center text-sm text-slate-500">
            <FileText size={14} className="mr-1" /> {data.pagination?.total ?? 0} document(s)
          </p>
        </div>
        <DataTable
          columns={columns}
          rows={data.items}
          loading={loading}
          pagination={data.pagination}
          onPageChange={setPage}
          emptyTitle="No documents"
          emptyDescription="Upload identity, education or employment documents to keep your file complete."
        />
      </Card>

      <Modal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        title="Upload document"
        description={isStaff ? 'Upload a document on behalf of an employee' : 'Upload a document to your HR file'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setUploadModal(false)}>
              Cancel
            </button>
            <button type="submit" form="document-form" className="btn btn-primary" disabled={busy}>
              Upload
            </button>
          </>
        }
      >
        <form id="document-form" onSubmit={upload} className="space-y-4">
          {isStaff ? (
            <Select
              label="Employee"
              placeholder="Select employee"
              value={form.employee}
              onChange={(event) => setForm({ ...form, employee: event.target.value })}
              options={employees.map((item) => ({ value: item.value, label: item.label }))}
            />
          ) : null}
          <Input label="Document title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <Select
            label="Category"
            required
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            options={DOCUMENT_CATEGORIES}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Issue date" type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} />
            <Input label="Expiry date" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
          </div>
          <div className="flex flex-col">
            <label className="label" htmlFor="document-file">
              File <span className="text-red-500">*</span>
            </label>
            <input id="document-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="field" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <p className="mt-1 text-xs text-slate-500">PDF, image or Word document up to the configured upload limit.</p>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(verifyModal)}
        onClose={() => setVerifyModal(null)}
        title="Verify document"
        description={verifyModal?.title}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setVerifyModal(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={verify} disabled={busy}>
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Decision"
            value={verifyForm.status}
            onChange={(event) => setVerifyForm({ ...verifyForm, status: event.target.value })}
            options={[
              { value: 'VERIFIED', label: 'Verified' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
          />
          <Input label="Comment" value={verifyForm.verificationComment} onChange={(event) => setVerifyForm({ ...verifyForm, verificationComment: event.target.value })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
        title="Delete document"
        message={`Delete '${confirmDelete?.title || ''}'? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={busy}
      />
    </div>
  );
};

export default DocumentsPage;
