import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const content = {
  privacy: {
    title: 'Privacy policy',
    intro: 'How this HRMS handles the people data stored inside it.',
    sections: [
      {
        heading: 'What is stored',
        body: 'Employee records, attendance, leave and remote-work requests, payroll and payslip data, performance reports, documents, assets, helpdesk tickets and audit logs. Records are held in the organization’s own MongoDB database, not in a third-party analytics service.',
      },
      {
        heading: 'Who can see it',
        body: 'Access is enforced by role. Super admins, admins, HR, finance and employees each receive only the modules and actions granted to their role. Employee-specific data is scoped to the authenticated user or their reporting chain.',
      },
      {
        heading: 'Sessions and cookies',
        body: 'Sign-in issues a short-lived access token and a rotating refresh token in an HTTP-only cookie. The access token is kept in browser storage so the interface can call the API. No advertising or tracking cookies are used.',
      },
      {
        heading: 'Audit and retention',
        body: 'Approvals, record changes and sensitive actions are written to an audit log with the actor and timestamp. Employee history is retained after exit so payroll, letters and audit records remain accurate.',
      },
      {
        heading: 'Your questions',
        body: 'For access, correction or deletion requests, contact your organization’s HR administrator. They control this deployment and its data.',
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'The rules for using this internal HRMS deployment.',
    sections: [
      {
        heading: 'Authorized use',
        body: 'This application is provided for authorized employees and administrators of the organization that operates it. Accounts are personal and must not be shared.',
      },
      {
        heading: 'Accurate records',
        body: 'Attendance, leave, remote-work, expense and performance information entered here may be used for payroll and statutory records. Submit accurate information and flag corrections through the attendance correction or helpdesk workflows.',
      },
      {
        heading: 'Availability',
        body: 'The platform is operated by your organization and depends on its hosting, database and network availability. No uptime guarantee is stated on this page.',
      },
      {
        heading: 'Changes',
        body: 'Modules, policies and these terms may change as the platform evolves. Continued use after a change constitutes acceptance of the updated terms.',
      },
    ],
  },
};

const LegalPage = ({ kind = 'privacy' }) => {
  const page = content[kind] || content.privacy;

  useEffect(() => {
    const previous = document.title;
    document.title = `${page.title} · Northwind HRMS`;
    return () => {
      document.title = previous;
    };
  }, [page.title]);

  return (
    <div className="landing-root min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700 hover:underline">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <div className="glass-card mt-5 p-6 sm:p-9">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <ShieldCheck size={21} />
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-slate-900">{page.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{page.intro}</p>

          <div className="mt-7 space-y-6">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-sm font-semibold text-slate-900">{section.heading}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{section.body}</p>
              </section>
            ))}
          </div>

          <p className="mt-8 border-t border-white/80 pt-4 text-[11px] text-slate-400">
            Last updated {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} · Northwind HRMS
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
