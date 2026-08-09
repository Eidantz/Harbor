type BrandMarkProps = {
  size?: 'sm' | 'lg';
  className?: string;
};

const sizes = {
  sm: { px: 28, src: '/brand/harbor-mark-64.png' },
  lg: { px: 72, src: '/brand/harbor-mark-256.png' },
} as const;

export function BrandMark({ size = 'sm', className = '' }: BrandMarkProps) {
  const { px, src } = sizes[size];
  return (
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      className={`brand-mark-img${size === 'lg' ? ' large' : ''} ${className}`.trim()}
      decoding="async"
      draggable={false}
    />
  );
}
