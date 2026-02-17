'use client';

import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { GripVertical } from 'lucide-react';
import type { ContractDeal } from '../../lib/types/contracts';

type Ui = {
  focusRing: string;
  surfaceHover: string;
  cardHover: string;
};

type Props = {
  deal: ContractDeal;
  ui: Ui;
  onClick: () => void;
  calc: (deal: ContractDeal) => { total: number };
  fmt: (n: number) => string;
};

export default function DealCard({ deal, ui, onClick, calc, fmt }: Props) {
  const c = calc(deal);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} className={['rounded-2xl', isDragging ? 'opacity-90 rotate-[0.2deg] shadow-sm' : ''].join(' ')}>
      <Card className={['rounded-2xl border border-stone-200/60 bg-stone-50/80', ui.surfaceHover, ui.cardHover].join(' ')}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            {/* ✅ 타이틀(왼쪽) */}
            <button type="button" onClick={onClick} className={['flex-1 text-left rounded-md', ui.focusRing].join(' ')}>
              <CardTitle className="text-sm font-semibold line-clamp-1">{deal.title}</CardTitle>
            </button>

            {/* ✅ 드래그 핸들(오른쪽) */}
            <button
              type="button"
              aria-label="드래그로 이동"
              className={[
                'ml-auto inline-flex h-7 w-7 items-center justify-end rounded-md',
                'text-slate-400 hover:text-slate-600',
                'hover:bg-white/70',
                'cursor-pointer',
                'opacity-70 hover:opacity-100 transition',
              ].join(' ')}
              {...listeners}
              {...attributes}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        {/* ✅ 본문도 클릭하면 모달 */}
        <CardContent onClick={onClick} className="space-y-2 cursor-pointer">
          <div className="text-xs text-muted-foreground line-clamp-1">{deal.customer}</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">총액(지표)</span>
            <span className="font-medium">{fmt(c.total)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">마감</span>
            <span className="font-medium">{deal.closeDate || '-'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
