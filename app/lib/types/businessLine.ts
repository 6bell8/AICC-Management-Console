export const BUSINESS_LINE_SERVICE_TYPES = ['B2G', 'STG', 'B2B', 'ETC'] as const;
export const BUSINESS_LINE_STATUSES = ['DONE', 'CANCELLED', 'PENDING'] as const;

export type BusinessLineServiceType = (typeof BUSINESS_LINE_SERVICE_TYPES)[number];
export type BusinessLineStatus = (typeof BUSINESS_LINE_STATUSES)[number];

export type BusinessLine = {
  id: string;
  jiraKey: string | null;
  lineNumber: string;
  serviceType: BusinessLineServiceType;
  botName: string;
  botCode: string;
  requester: string;
  requestedAt: string;
  endedAt: string | null;
  regiStatus: BusinessLineStatus;
  memo: string | null;
};
