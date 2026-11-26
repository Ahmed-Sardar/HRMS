import { forwardRef } from 'react';
import cn from '../../utils/cn';

const baseWrapper = 'flex flex-col';

export const FieldWrapper = ({ label, htmlFor, error, hint, required, children, className }) => (
  <div className={cn(baseWrapper, className)}>
    {label ? (
      <label className="label" htmlFor={htmlFor}>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
    ) : null}
    {children}
    {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    {!error && hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
  </div>
);

export const Input = forwardRef(({ label, error, hint, required, className, id, ...props }, ref) => (
  <FieldWrapper label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
    <input ref={ref} id={id} className={cn('field', error && 'field-error')} {...props} />
  </FieldWrapper>
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ label, error, hint, required, className, id, rows = 4, ...props }, ref) => (
  <FieldWrapper label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
    <textarea ref={ref} id={id} rows={rows} className={cn('field', error && 'field-error')} {...props} />
  </FieldWrapper>
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ label, error, hint, required, className, id, children, options, placeholder, ...props }, ref) => (
  <FieldWrapper label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
    <select ref={ref} id={id} className={cn('field', error && 'field-error')} {...props}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options
        ? options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        : children}
    </select>
  </FieldWrapper>
));
Select.displayName = 'Select';

export const Checkbox = ({ label, className, id, ...props }) => (
  <label className={cn('flex cursor-pointer items-center gap-2 text-sm text-slate-700', className)} htmlFor={id}>
    <input id={id} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-navy-600 accent-navy-600 focus:ring-navy-500/40" {...props} />
    {label}
  </label>
);

export const FormGrid = ({ children, columns = 2, className }) => (
  <div
    className={cn(
      'grid gap-4',
      columns === 1 && 'grid-cols-1',
      columns === 2 && 'grid-cols-1 sm:grid-cols-2',
      columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      className,
    )}
  >
    {children}
  </div>
);

export const FormActions = ({ children, className }) => (
  <div className={cn('mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-white/70 pt-4', className)}>
    {children}
  </div>
);

export default Input;
