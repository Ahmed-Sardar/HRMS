import { ChevronLeft, ChevronRight } from 'lucide-react';
import cn from '../../utils/cn';
import EmptyState from './EmptyState';

const SkeletonRow = ({ columns }) => (
  <tr>
    {columns.map((column, index) => (
      <td key={`${column.key}-${index}`} className="border-b border-white/50 px-4 py-3">
        <div className="skeleton h-3.5 w-full max-w-[160px]" />
      </td>
    ))}
  </tr>
);

const DataTable = ({
  columns,
  rows = [],
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'Adjust your filters or add a new record to get started.',
  emptyAction = null,
  pagination,
  onPageChange,
  rowKey = '_id',
  onRowClick,
  footer,
  dense = false,
}) => {
  const showPagination = pagination && pagination.pages > 1;

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.headerClassName}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => <SkeletonRow key={index} columns={columns} />)
              : rows.map((row, rowIndex) => (
                  <tr
                    key={row[rowKey] || rowIndex}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={cn(dense && 'py-2', column.className)}>
                        {column.render ? column.render(row, rowIndex) : row[column.key] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
          {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : null}

      {showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/70 bg-white/30 px-4 py-3 text-sm text-slate-600 backdrop-blur">
          <p>
            Showing page <span className="font-semibold text-slate-800">{pagination.page}</span> of{' '}
            <span className="font-semibold text-slate-800">{pagination.pages}</span> &middot; {pagination.total} records
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!pagination.hasPrev}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!pagination.hasNext}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DataTable;
