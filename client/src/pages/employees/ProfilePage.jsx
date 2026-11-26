import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { KeyRound, Save, ShieldCheck, Smartphone, LogOut, Mail, User } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import Avatar from '../../components/ui/Avatar';
import { Input, Textarea, FormGrid, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import Alert from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import useAuth from '../../hooks/useAuth';
import { employeeService } from '../../services/employee.service';
import { authService } from '../../services/auth.service';
import { getErrorMessage } from '../../services/api';
import { formatDateTime, formatDate } from '../../utils/format';
import { EMPLOYMENT_STATUS_LABELS } from '../../utils/constants';

const ProfilePage = () => {
  const { user, role } = useAuth();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'profile');
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [workEmailModal, setWorkEmailModal] = useState(false);
  const [workEmailStage, setWorkEmailStage] = useState('REQUEST');
  const [workEmailValue, setWorkEmailValue] = useState('');
  const [workEmailOtp, setWorkEmailOtp] = useState('');
  const [workEmailRequest, setWorkEmailRequest] = useState(null);
  const [workEmailError, setWorkEmailError] = useState('');
  const [workEmailBusy, setWorkEmailBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeeService.me();
      setEmployee(data);
      setForm({
        phone: data.phone || '',
        altPhone: data.altPhone || '',
        personalEmail: data.personalEmail || '',
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().slice(0, 10) : '',
        gender: data.gender || 'UNDISCLOSED',
        maritalStatus: data.maritalStatus || 'SINGLE',
        about: data.about || '',
        skills: (data.skills || []).join(', '),
        address: {
          line1: data.address?.line1 || '',
          line2: data.address?.line2 || '',
          city: data.address?.city || '',
          state: data.address?.state || '',
          postalCode: data.address?.postalCode || '',
          country: data.address?.country || 'India',
        },
        emergencyContact: {
          name: data.emergencyContact?.name || '',
          relation: data.emergencyContact?.relation || '',
          phone: data.emergencyContact?.phone || '',
        },
        bankDetails: {
          accountName: data.bankDetails?.accountName || '',
          accountNumber: data.bankDetails?.accountNumber || '',
          bankName: data.bankDetails?.bankName || '',
          ifscCode: data.bankDetails?.ifscCode || '',
          panNumber: data.bankDetails?.panNumber || '',
        },
      });
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const loadSecurity = useCallback(async () => {
    try {
      const [sessionData, history] = await Promise.all([authService.sessions(), authService.loginHistory()]);
      setSessions(sessionData || []);
      setLoginHistory(history.history || []);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    load();
    loadSecurity();
  }, [load, loadSecurity]);

  const changeTab = (next) => {
    setTab(next);
    if (next === 'security') setSearchParams({ tab: 'security' });
    else setSearchParams({});
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        skills: form.skills ? form.skills.split(',').map((item) => item.trim()).filter(Boolean) : [],
        dateOfBirth: form.dateOfBirth || undefined,
      };
      await employeeService.updateMe(payload);
      dispatch(toast('Profile updated'));
      load();
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      dispatch(toast('New passwords do not match', 'error'));
      return;
    }
    setPasswordBusy(true);
    try {
      await authService.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      dispatch(toast('Password changed. Please sign in again.'));
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    } finally {
      setPasswordBusy(false);
    }
  };

  const openWorkEmailModal = () => {
    setWorkEmailError('');
    setWorkEmailStage('REQUEST');
    setWorkEmailValue('');
    setWorkEmailOtp('');
    setWorkEmailRequest(null);
    setWorkEmailModal(true);
  };

  const closeWorkEmailModal = () => {
    if (workEmailBusy) return;
    setWorkEmailModal(false);
  };

  const sendWorkEmailCode = async () => {
    if (!employee?._id) return;
    setWorkEmailBusy(true);
    setWorkEmailError('');
    try {
      const result = await employeeService.requestEmailChange(employee._id, {
        emailType: 'WORK',
        newEmail: workEmailValue.trim(),
      });
      setWorkEmailRequest(result);
      setWorkEmailStage('VERIFY');
      dispatch(
        toast(
          result.delivery?.sent
            ? 'Verification code sent to the new address'
            : 'Verification code created, but email delivery is not configured',
        ),
      );
    } catch (err) {
      setWorkEmailError(getErrorMessage(err));
    } finally {
      setWorkEmailBusy(false);
    }
  };

  const confirmWorkEmail = async () => {
    if (!employee?._id || !workEmailRequest?.request?._id) return;
    setWorkEmailBusy(true);
    setWorkEmailError('');
    try {
      await employeeService.verifyEmailChange(employee._id, workEmailRequest.request._id, workEmailOtp.trim());
      dispatch(toast('Official work email updated'));
      setWorkEmailModal(false);
      load();
    } catch (err) {
      setWorkEmailError(getErrorMessage(err));
    } finally {
      setWorkEmailBusy(false);
    }
  };

  const revokeSessions = async () => {
    try {
      await authService.revokeSessions();
      dispatch(toast('All other sessions revoked'));
      loadSecurity();
    } catch (err) {
      dispatch(toast(getErrorMessage(err), 'error'));
    }
  };

  if (loading) return <PageLoader label="Loading your profile..." />;
  if (!form) return null;

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Manage your personal information, banking details and account security."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Profile' }]}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4 p-5">
            <Avatar name={user?.name} src={employee?.profilePhoto} size="lg" />
            <div>
              <p className="text-lg font-semibold text-slate-900">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="chip bg-navy-50 text-navy-800">{role}</span>
                {employee?.employmentStatus ? (
                  <StatusBadge status={employee.employmentStatus} labels={EMPLOYMENT_STATUS_LABELS} />
                ) : null}
                <span className="chip bg-slate-100 text-slate-600">{employee?.employeeId || '—'}</span>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="grid grid-cols-2 gap-3 p-5 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Department</p>
              <p className="mt-0.5 font-medium text-slate-800">{employee?.department?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Designation</p>
              <p className="mt-0.5 font-medium text-slate-800">{employee?.designation?.title || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Joined</p>
              <p className="mt-0.5 font-medium text-slate-800">{formatDate(employee?.dateOfJoining)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Manager</p>
              <p className="mt-0.5 font-medium text-slate-800">
                {employee?.reportingManager
                  ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
                  : '—'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              { key: 'profile', label: 'Personal details' },
              { key: 'security', label: 'Password & sessions' },
            ]}
            value={tab}
            onChange={changeTab}
          />
        </div>

        {tab === 'profile' ? (
          <form onSubmit={saveProfile} className="space-y-6 p-5">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <User size={15} /> Contact information
              </h3>
              <FormGrid columns={3}>
                <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input label="Alternate phone" value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })} />
                <Input label="Personal email" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
                <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                <Select
                  label="Gender"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  options={[
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' },
                    { value: 'OTHER', label: 'Other' },
                    { value: 'UNDISCLOSED', label: 'Prefer not to say' },
                  ]}
                />
                <Select
                  label="Marital status"
                  value={form.maritalStatus}
                  onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                  options={[
                    { value: 'SINGLE', label: 'Single' },
                    { value: 'MARRIED', label: 'Married' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
              </FormGrid>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Official work email</p>
                  <p className="mt-0.5 break-all text-sm text-slate-800">{employee?.email || '—'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Used to sign in. Changing it requires verifying the new address.
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={openWorkEmailModal}>
                  <Mail size={13} /> Request change
                </button>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Address</h3>
              <FormGrid columns={3}>
                <Input label="Address line 1" value={form.address.line1} onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })} />
                <Input label="Address line 2" value={form.address.line2} onChange={(e) => setForm({ ...form, address: { ...form.address, line2: e.target.value } })} />
                <Input label="City" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
                <Input label="State" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} />
                <Input label="Postal code" value={form.address.postalCode} onChange={(e) => setForm({ ...form, address: { ...form.address, postalCode: e.target.value } })} />
                <Input label="Country" value={form.address.country} onChange={(e) => setForm({ ...form, address: { ...form.address, country: e.target.value } })} />
              </FormGrid>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Emergency contact</h3>
              <FormGrid columns={3}>
                <Input label="Name" value={form.emergencyContact.name} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} />
                <Input label="Relationship" value={form.emergencyContact.relation} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relation: e.target.value } })} />
                <Input label="Phone" value={form.emergencyContact.phone} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })} />
              </FormGrid>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Bank details</h3>
              <FormGrid columns={3}>
                <Input label="Account holder" value={form.bankDetails.accountName} onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, accountName: e.target.value } })} />
                <Input label="Account number" value={form.bankDetails.accountNumber} onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, accountNumber: e.target.value } })} />
                <Input label="Bank name" value={form.bankDetails.bankName} onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, bankName: e.target.value } })} />
                <Input label="IFSC code" value={form.bankDetails.ifscCode} onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, ifscCode: e.target.value } })} />
                <Input label="PAN number" value={form.bankDetails.panNumber} onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, panNumber: e.target.value } })} />
              </FormGrid>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Professional summary</h3>
              <FormGrid columns={1}>
                <Input label="Skills" hint="Comma separated" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
                <Textarea label="About" rows={3} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
              </FormGrid>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-4">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <KeyRound size={15} /> Change password
              </h3>
              <form onSubmit={changePassword} className="space-y-3">
                <Input
                  label="Current password"
                  type="password"
                  required
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                />
                <Input
                  label="New password"
                  type="password"
                  required
                  hint="Minimum 8 characters with a letter and a number"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  required
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                />
                <button type="submit" className="btn btn-primary" disabled={passwordBusy}>
                  {passwordBusy ? 'Updating...' : 'Update password'}
                </button>
              </form>

              <h3 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShieldCheck size={15} /> Login history
              </h3>
              <div className="space-y-2">
                {loginHistory.slice(0, 6).map((entry, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs">
                    <span className="text-slate-600">{entry.ip || 'Unknown IP'}</span>
                    <span className={entry.success ? 'text-emerald-600' : 'text-red-600'}>
                      {entry.success ? 'Success' : entry.reason || 'Failed'}
                    </span>
                    <span className="text-slate-400">{formatDateTime(entry.at)}</span>
                  </div>
                ))}
                {!loginHistory.length ? <p className="text-sm text-slate-500">No login history recorded.</p> : null}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Smartphone size={15} /> Active sessions
                </h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={revokeSessions}>
                  <LogOut size={13} /> Revoke all
                </button>
              </div>
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div key={session._id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                    <p className="font-medium text-slate-700">{session.createdByIp || 'Unknown IP'}</p>
                    <p className="mt-0.5 truncate text-slate-500">{session.userAgent || 'Unknown device'}</p>
                    <p className="mt-0.5 text-slate-400">Expires {formatDateTime(session.expiresAt)}</p>
                  </div>
                ))}
                {!sessions.length ? <p className="text-sm text-slate-500">No active sessions.</p> : null}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={workEmailModal}
        onClose={closeWorkEmailModal}
        title="Change official work email"
        description="The new address must be verified before it replaces your current login email."
        footer={
          workEmailStage === 'REQUEST' ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={closeWorkEmailModal} disabled={workEmailBusy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={sendWorkEmailCode} disabled={workEmailBusy}>
                {workEmailBusy ? 'Sending...' : 'Send verification code'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setWorkEmailStage('REQUEST');
                  setWorkEmailOtp('');
                  setWorkEmailError('');
                }}
                disabled={workEmailBusy}
              >
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmWorkEmail} disabled={workEmailBusy}>
                {workEmailBusy ? 'Verifying...' : 'Verify & update'}
              </button>
            </>
          )
        }
      >
        <div className="space-y-3">
          {workEmailError ? <Alert tone="error">{workEmailError}</Alert> : null}
          {workEmailStage === 'REQUEST' ? (
            <>
              <Input
                label="New official work email"
                type="email"
                required
                value={workEmailValue}
                onChange={(event) => setWorkEmailValue(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                Current address: {employee?.email || '—'}. The employee record and login account are updated together
                after verification.
              </p>
            </>
          ) : (
            <>
              <Alert tone="warning">
                A 6 digit verification code was created for {workEmailRequest?.request?.newEmail}.{' '}
                {workEmailRequest?.delivery?.sent
                  ? 'Check that mailbox to continue.'
                  : 'Email delivery is not configured on this server, so no message was sent.'}
              </Alert>
              {workEmailRequest?.devOtp ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Development verification code:{' '}
                  <span className="font-mono text-sm text-slate-900">{workEmailRequest.devOtp}</span>
                </p>
              ) : null}
              <Input
                label="Verification code"
                inputMode="numeric"
                maxLength={6}
                required
                value={workEmailOtp}
                onChange={(event) => setWorkEmailOtp(event.target.value.replace(/\D/g, ''))}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ProfilePage;
