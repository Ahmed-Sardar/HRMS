import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

const NotFoundPage = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      <Compass size={26} />
    </span>
    <h1 className="mt-4 text-2xl font-semibold text-slate-900">Page not found</h1>
    <p className="mt-1 max-w-md text-sm text-slate-500">
      The page you requested does not exist, or you may not have access to it with your current role.
    </p>
    <Link to="/" className="btn btn-primary mt-5">
      Back to dashboard
    </Link>
  </div>
);

export default NotFoundPage;
