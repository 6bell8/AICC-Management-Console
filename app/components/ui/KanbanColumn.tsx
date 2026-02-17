'use client';

import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/app/components/ui/badge';
import type { ContractStatus } from '../../lib/types/contracts';

type Ui = {
  surface: string;
};

type Props = {
  status: ContractStatus;
  label: string;
  count: number;
  ui: Ui;
  children: ReactNode;
};

export default function KanbanColumn({ status, label, count, ui, children }: Props) {
  // ✅ prefix로 컬럼 id 명확히
  const droppableId = `col:${status}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 py-1">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <Badge variant="secondary" className="bg-stone-100 text-slate-700">
          {count}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={[
          // ✅ relative: 라인/그라데이션 오버레이를 위해 필요
          'relative space-y-2 rounded-2xl border p-2 transition',
          ui.surface,

          // ✅ 기본 hover는 그대로 두고, isOver 때만 확실하게
          isOver ? 'border-amber-200/60 ring-2 ring-amber-200/40' : '',
          isOver ? 'bg-gradient-to-b from-amber-50/60 via-white/10 to-white/0' : '',
        ].join(' ')}
      >
        {/* ✅ “안착 라인” (컬럼에 들어오면 위쪽에 딱 선이 생김) */}
        {isOver && (
          <div
            className={[
              'pointer-events-none absolute inset-x-2 top-2 h-1 rounded-full',
              'bg-gradient-to-r from-amber-200/30 via-amber-300/60 to-amber-200/30',
            ].join(' ')}
          />
        )}

        {/* ✅ 카드들 */}
        {children}

        {/* (선택) 빈 컬럼일 때도 “드롭 가능” 영역이 보이게 미니 높이 확보 */}
        <div className="pointer-events-none h-1" />
      </div>
    </div>
  );
}
