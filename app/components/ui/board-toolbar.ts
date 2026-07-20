// Board list toolbar policy: search stays left with a capped width, actions stay pinned right.
export const boardToolbarClass = 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between';

export const boardToolbarSearchClass =
  'grid w-full min-w-0 grid-cols-[minmax(0,1fr)_40px] items-center gap-2 transition-all duration-200 ease-out focus-within:sm:max-w-[680px] sm:max-w-[520px]';

export const boardToolbarActionsClass = 'flex shrink-0 justify-end gap-2 sm:ml-auto';

export const boardToolbarIconButtonClass =
  'h-10 w-10 shrink-0 p-0 transition-colors hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700';
