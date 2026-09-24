export function LionMark({ className = '', size = 46 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="m32 4 17 9 10 21-7 15-20 12-20-12-7-15 10-21Z" />
        <path d="m32 10 12 8 8 17-7 14-13 7-13-7-7-14 8-17Z" opacity=".48" />
        <path d="m19 23 8-5 5 4 5-4 8 5-3 17-10 10-10-10Z" />
        <path d="m20 28 7 3m17-3-7 3m-10 6 5 4 5-4m-5 4v9m-9-30-5-8m23 8 5-8M12 36l10 4m30-4-10 4M15 49l7-9m27 9-7-9" />
        <path d="m28 37 4-2 4 2-4 3Z" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export function BrandTitle({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-title ${compact ? 'brand-title--compact' : ''}`}>
      <div className="arabic-title" lang="ar" dir="rtl">أسود الجزائر</div>
      <h1><span>LIONS OF</span><strong>ALGERIA</strong></h1>
    </div>
  );
}