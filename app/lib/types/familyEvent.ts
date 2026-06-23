export const FAMILY_EVENT_TYPES = ['MARRIAGE', 'BIRTH', 'FUNERAL', 'FIRST_BIRTHDAY', 'HOSPITAL', 'OTHER'] as const;
export const FAMILY_EVENT_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'REJECTED'] as const;

export type FamilyEventType = (typeof FAMILY_EVENT_TYPES)[number];
export type FamilyEventStatus = (typeof FAMILY_EVENT_STATUSES)[number];

export type FamilyEventRequest = {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  teamId: string | null;
  teamName: string | null;
  eventType: FamilyEventType;
  relation: string;
  eventDate: string;
  location: string;
  note: string;
  wreathRequired: boolean;
  status: FamilyEventStatus;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyEventDashboardSummary = {
  upcomingCount: number;
  recentItems: Array<Pick<FamilyEventRequest, 'id' | 'eventType' | 'relation' | 'eventDate'>>;
};
