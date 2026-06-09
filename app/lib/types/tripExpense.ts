export const TRANSPORT_TYPES = ['TRAIN', 'CAR', 'BUS', 'TAXI', 'OTHER'] as const;
export const TRIP_SCOPES = ['IN_CITY', 'OUT_CITY'] as const;

export type TransportType = (typeof TRANSPORT_TYPES)[number];
export type TripScope = (typeof TRIP_SCOPES)[number];

export type TripExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type TripExpenseSettlementStatus = 'PENDING' | 'PAID';

export type EligibleBusinessTrip = {
  id: string;
  startDate: string;
  endDate: string;
  requesterName: string;
  teamName: string | null;
  reason: string | null;
};

export type TripExpenseAttachment = {
  id: string;
  storageProvider: 'RAILWAY_BUCKET' | 'LOCAL_MOCK';
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
};

export type TripExpenseRequest = {
  id: string;
  businessTripRequestId: string;
  requesterId: string;
  requesterName: string;
  teamId: string | null;
  teamName: string | null;
  origin: string;
  destination: string;
  tripScope: TripScope;
  transportType: TransportType;
  trainFareAmount: number;
  carDepreciationAmount: number;
  otherAmount: number;
  lodgingNights: number;
  dailyAllowanceAmount: number;
  lodgingAmount: number;
  totalAmount: number;
  memo: string | null;
  status: TripExpenseStatus;
  settlementStatus: TripExpenseSettlementStatus;
  settledByName: string | null;
  settledAt: string | null;
  paymentDate: string | null;
  paymentAccount: string | null;
  settlementMemo: string | null;
  approverName: string | null;
  approvalStepId: string | null;
  attachments: TripExpenseAttachment[];
  createdAt: string;
  updatedAt: string;
};
