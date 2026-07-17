type DetailTimestampBadgeProps = {
  createdAt?: string | null;
  updatedAt?: string | null;
};

function toTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatDate(value?: string | null) {
  const time = toTime(value);
  if (time == null) return '-';
  const date = new Date(time);
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`;
}

export function DetailTimestampBadge({ createdAt, updatedAt }: DetailTimestampBadgeProps) {
  const createdTime = toTime(createdAt);
  const updatedTime = toTime(updatedAt);
  const isUpdated = createdTime != null && updatedTime != null && Math.abs(updatedTime - createdTime) > 1000;
  const label = isUpdated ? '수정' : '생성';
  const value = isUpdated ? updatedAt : createdAt;

  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      {label} {formatDate(value)}
    </span>
  );
}
