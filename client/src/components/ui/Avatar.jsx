import cn from '../../utils/cn';
import { initials } from '../../utils/format';

const sizes = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
};

const Avatar = ({ name, src, size = 'sm', className }) => {
  if (src) {
    return <img src={src} alt={name || 'Profile'} className={cn('rounded-full object-cover', sizes[size], className)} />;
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-navy-100 to-aurora-100 font-semibold text-navy-700 ring-1 ring-white/70',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
};

export default Avatar;
