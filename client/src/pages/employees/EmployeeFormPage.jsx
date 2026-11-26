import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Save } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input, Select, Textarea, FormGrid, FormActions } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/Loader';
import { toast } from '../../store/uiSlice';
import { employeeService, departmentService, designationService } from '../../services/employee.service';
import { getErrorMessage } from '../../services/api';
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  ROLE_LABELS,
  ROLES,
} from '../../utils/constants';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  dateOfJoining: z.string().min(1, 'Joining date is required'),
  phone: z.string().optional(),
  personalEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  reportingManager: z.string().optional(),
  employmentType: z.string().optional(),
  employmentStatus: z.string().optional(),
  workLocation: z.string().optional(),
  role: z.string().optional(),
  password: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyRelation: z.string().optional(),
  emergencyPhone: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  ifscCode: z.string().optional(),
  panNumber: z.string().optional(),
  about: z.string().optional(),
  skills: z.string().optional(),
});

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const EmployeeFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [credentials, setCredentials] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    // Never leave the role/type selects unset: an unset native <select> submits its
    // first option, which previously created new employees as Super Admin.
    defaultValues: {
      role: ROLES.EMPLOYEE,
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
    },
  });

  const selectedDepartment = watch('department');

  useEffect(() => {
    Promise.all([departmentService.list({ limit: 100 }), employeeService.options()])
      .then(([deptRes, managerRes]) => {
        setDepartments(deptRes.items || []);
        setManagers(managerRes || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    designationService
      .list(selectedDepartment ? { department: selectedDepartment } : {})
      .then(setDesignations)
      .catch(() => setDesignations([]));
  }, [selectedDepartment]);

  useEffect(() => {
    if (!isEdit) return;
    employeeService
      .get(id)
      .then((employee) => {
        reset({
          firstName: employee.firstName || '',
          lastName: employee.lastName || '',
          email: employee.email || '',
          phone: employee.phone || '',
          personalEmail: employee.personalEmail || '',
          dateOfBirth: toDateInput(employee.dateOfBirth),
          dateOfJoining: toDateInput(employee.dateOfJoining),
          department: employee.department?._id || '',
          designation: employee.designation?._id || '',
          reportingManager: employee.reportingManager?._id || '',
          employmentType: employee.employmentType || 'FULL_TIME',
          employmentStatus: employee.employmentStatus || 'ACTIVE',
          workLocation: employee.workLocation || '',
          addressLine1: employee.address?.line1 || '',
          city: employee.address?.city || '',
          state: employee.address?.state || '',
          postalCode: employee.address?.postalCode || '',
          emergencyName: employee.emergencyContact?.name || '',
          emergencyRelation: employee.emergencyContact?.relation || '',
          emergencyPhone: employee.emergencyContact?.phone || '',
          accountName: employee.bankDetails?.accountName || '',
          accountNumber: employee.bankDetails?.accountNumber || '',
          bankName: employee.bankDetails?.bankName || '',
          ifscCode: employee.bankDetails?.ifscCode || '',
          panNumber: employee.bankDetails?.panNumber || '',
          about: employee.about || '',
          skills: (employee.skills || []).join(', '),
        });
      })
      .catch((err) => setServerError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit, reset]);

  const onSubmit = async (values) => {
    setSaving(true);
    setServerError('');
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone || undefined,
      personalEmail: values.personalEmail || undefined,
      dateOfBirth: values.dateOfBirth || undefined,
      dateOfJoining: values.dateOfJoining,
      department: values.department || undefined,
      designation: values.designation || undefined,
      reportingManager: values.reportingManager || undefined,
      employmentType: values.employmentType || undefined,
      employmentStatus: values.employmentStatus || undefined,
      workLocation: values.workLocation || undefined,
      address: {
        line1: values.addressLine1,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode,
        country: 'India',
      },
      emergencyContact: {
        name: values.emergencyName,
        relation: values.emergencyRelation,
        phone: values.emergencyPhone,
      },
      bankDetails: {
        accountName: values.accountName,
        accountNumber: values.accountNumber,
        bankName: values.bankName,
        ifscCode: values.ifscCode,
        panNumber: values.panNumber,
      },
      about: values.about || undefined,
      skills: values.skills ? values.skills.split(',').map((item) => item.trim()).filter(Boolean) : [],
    };

    try {
      if (isEdit) {
        await employeeService.update(id, payload);
        dispatch(toast('Employee record updated'));
        navigate(`/employees/${id}`);
      } else {
        const result = await employeeService.create({
          ...payload,
          role: values.role || ROLES.EMPLOYEE,
          password: values.password || undefined,
        });
        dispatch(toast('Employee created successfully'));
        if (result.credentials) {
          setCredentials(result.credentials);
        } else {
          navigate(`/employees/${result.employee._id}`);
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setServerError(message);
      dispatch(toast(message, 'error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="Loading employee record..." />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit employee' : 'Add employee'}
        description={
          isEdit
            ? 'Update employment details. Sensitive fields are restricted by role.'
            : 'Create the employee profile and a login account in one step.'
        }
        breadcrumb={[{ label: 'Employees', to: '/employees' }, { label: isEdit ? 'Edit' : 'New' }]}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} /> Back
          </button>
        }
      />

      {serverError ? (
        <Alert tone="error" className="mb-4">
          {serverError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader title="Personal information" description="Basic identity and contact details" />
          <div className="p-5">
            <FormGrid columns={3}>
              <Input label="First name" required error={errors.firstName?.message} {...register('firstName')} />
              <Input label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
              <Input label="Work email" type="email" required error={errors.email?.message} {...register('email')} />
              <Input label="Phone" {...register('phone')} />
              <Input label="Personal email" type="email" {...register('personalEmail')} />
              <Input label="Date of birth" type="date" {...register('dateOfBirth')} />
            </FormGrid>
          </div>
        </Card>

        <Card>
          <CardHeader title="Employment details" description="Role, department and reporting line" />
          <div className="p-5">
            <FormGrid columns={3}>
              <Input label="Joining date" type="date" required error={errors.dateOfJoining?.message} {...register('dateOfJoining')} />
              <Select
                label="Department"
                placeholder="Select department"
                options={departments.map((dept) => ({ value: dept._id, label: `${dept.name} (${dept.code})` }))}
                {...register('department')}
              />
              <Select
                label="Designation"
                placeholder="Select designation"
                options={designations.map((item) => ({ value: item._id, label: item.title }))}
                {...register('designation')}
              />
              <Select
                label="Reporting manager"
                placeholder="No manager"
                options={managers.map((item) => ({ value: item.value, label: item.label }))}
                {...register('reportingManager')}
              />
              <Select
                label="Employment type"
                options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                {...register('employmentType')}
              />
              <Select
                label="Employment status"
                options={Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                {...register('employmentStatus')}
              />
              <Input label="Work location" placeholder="Mumbai HQ" {...register('workLocation')} />
              {!isEdit ? (
                <>
                  <Select
                    label="System role"
                    options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
                    {...register('role')}
                  />
                  <Input
                    label="Temporary password"
                    placeholder="Leave blank to auto-generate"
                    hint="Minimum 8 characters with a number."
                    {...register('password')}
                  />
                </>
              ) : null}
            </FormGrid>
          </div>
        </Card>

        <Card>
          <CardHeader title="Address & emergency contact" description="Used by HR for official records" />
          <div className="p-5">
            <FormGrid columns={3}>
              <Input label="Address line 1" {...register('addressLine1')} />
              <Input label="City" {...register('city')} />
              <Input label="State" {...register('state')} />
              <Input label="Postal code" {...register('postalCode')} />
              <Input label="Emergency contact name" {...register('emergencyName')} />
              <Input label="Relationship" {...register('emergencyRelation')} />
              <Input label="Emergency contact phone" {...register('emergencyPhone')} />
            </FormGrid>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Bank & payroll details"
            description="Visible only to authorized payroll roles"
          />
          <div className="p-5">
            <FormGrid columns={3}>
              <Input label="Account holder name" {...register('accountName')} />
              <Input label="Account number" {...register('accountNumber')} />
              <Input label="Bank name" {...register('bankName')} />
              <Input label="IFSC code" {...register('ifscCode')} />
              <Input label="PAN number" {...register('panNumber')} />
            </FormGrid>
          </div>
        </Card>

        <Card>
          <CardHeader title="Additional information" description="Skills and a short professional summary" />
          <div className="p-5">
            <FormGrid columns={1}>
              <Input label="Skills" hint="Comma separated, e.g. React, Node.js, MongoDB" {...register('skills')} />
              <Textarea label="About" rows={3} {...register('about')} />
            </FormGrid>
          </div>
          <FormActions className="mx-5 mb-5 mt-0">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create employee'}
            </button>
          </FormActions>
        </Card>
      </form>

      <Modal
        open={Boolean(credentials)}
        onClose={() => navigate('/employees')}
        title="Employee created"
        description="Share these credentials securely with the employee."
        footer={
          <button type="button" className="btn btn-primary" onClick={() => navigate('/employees')}>
            Done
          </button>
        }
      >
        <div className="space-y-3 text-sm">
          <Alert tone="warning">The temporary password is shown only once. The employee must change it after signing in.</Alert>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Login email</p>
            <p className="font-mono text-sm text-slate-900">{credentials?.email}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Temporary password</p>
            <p className="font-mono text-sm text-slate-900">{credentials?.temporaryPassword}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeFormPage;
