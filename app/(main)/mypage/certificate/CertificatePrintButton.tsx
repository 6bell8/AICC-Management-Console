'use client';

import { Printer } from 'lucide-react';

export default function CertificatePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
    >
      <Printer className="h-4 w-4" />
      인쇄 / PDF 저장
    </button>
  );
}
