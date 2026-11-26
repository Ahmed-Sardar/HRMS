import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../store/uiSlice';
import { notificationService } from '../../services/notification.service';
import { getErrorMessage } from '../../services/api';
import { formatEnum } from '../../utils/constants';
import { relativeTime } from '../../utils/format';
import useAuth from '../../hooks/useAuth';

const typeTone = {
  LEAVE: 'bg-indigo-50 text-indigo-700',
  ATTENDANCE: 'bg-amber-50 text-amber-700',
  PAYROLL: 'bg-emerald-50 text-emerald-700',
  PERFORMANCE: 'bg-blue-50 text-blue-700',
  HR: 'bg-emerald-50 text-emerald-700',
  FINANCE: 'bg-amber-50 text-amber-700',
  DOCUMENT: 'bg-slate-100 text-slate-600',
  ASSET: 'bg-slate-100 text-slate-600',
  ANNOUNCEMENT: 'bg-navy-50 text-navy-800',
};

const NotificationsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState({ items: [], pagination: null, unread: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? { isRead: false } : filter === 'read' ? { isRead: true } : {};
      setData(await notificationService.list({ ...params, limit: 50 }));
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openNotification = async (item) => {
    try {
      if (!item.isRead) await notificationService.markRead(item._id);
      if (item.link) navigate(item.link);
      else load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const markAll = async () => {
    try {
      await notificationService.markAllRead();
      dispatch(toast('All notifications marked as read'));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  const remove = async (event, item) => {
    event.stopPropagation();
    try {
      await notificationService.remove(item._id);
      dispatch(toast('Notification removed'));
      load();
    } catch (error) {
      dispatch(toast(getErrorMessage(error), 'error'));
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`Alerts for ${user?.name || 'your account'}, newest first.`}
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]}
        actions={
          <button type="button" className="btn btn-secondary" onClick={markAll} disabled={!data.unread}>
            <CheckCheck size={15} /> Mark all read
          </button>
        }
      />

      <Card>
        <div className="px-4 pt-2">
          <Tabs
            items={[
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread', count: data.unread },
              { key: 'read', label: 'Read' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500">Loading notifications...</p>
        ) : data.items.length ? (
          <ul className="divide-y divide-slate-100">
            {data.items.map((item) => (
              <li key={item._id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex cursor-pointer items-start gap-3 px-5 py-4 transition hover:bg-slate-50 ${item.isRead ? '' : 'bg-blue-50/40'}`}
                  onClick={() => openNotification(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') openNotification(item);
                  }}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeTone[item.type] || 'bg-slate-100 text-slate-600'}`}>
                    <Bell size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm ${item.isRead ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>{item.title}</p>
                      <Badge>{formatEnum(item.type)}</Badge>
                      {item.priority === 'HIGH' ? <Badge tone="bg-red-50 text-red-700">High</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{relativeTime(item.createdAt)}</p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm text-slate-400" onClick={(event) => remove(event, item)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Bell} title="No notifications" description="You are all caught up. New alerts will appear here." />
        )}
      </Card>
    </div>
  );
};

export default NotificationsPage;
