import { cn } from './utils';

export function LastEditorBadge({ className, name }: { className?: string; name?: string | null }) {
  const editorName = name?.trim();
  if (!editorName) return null;

  return (
    <span
      className={cn(
        'inline-flex max-w-[9.5rem] shrink-0 items-center rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-sky-700',
        className,
      )}
      title={`작성자: ${editorName}`}
    >
      <span className="shrink-0">작성자:</span>
      <span className="ml-1 min-w-0 truncate">{editorName}</span>
    </span>
  );
}
