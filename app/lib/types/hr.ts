export const REQUEST_TYPES = ['ANNUAL', 'AM_HALF', 'PM_HALF', 'SICK', 'OFFICIAL', 'COMP', 'BUSINESS_TRIP', 'TRIP_EXPENSE'] as const;
export const REQUEST_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED'] as const;
export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type HalfDay = 'AM' | 'PM' | null;

export type Team = {
  id: string;
  name: string;
  headUserId: string | null;
  headName: string | null;
};

export const EMPLOYEE_POSITIONS = ['STAFF', 'ASSISTANT_MANAGER', 'MANAGER', 'SENIOR_MANAGER', 'DIRECTOR'] as const;
export type EmployeePosition = (typeof EMPLOYEE_POSITIONS)[number];
export const EMPLOYMENT_TYPES = ['P', 'E'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export type LeaveBalanceSummary = {
  employmentType: EmploymentType;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
};

export type EmployeeProfile = {
  userId: string;
  teamId: string | null;
  teamName: string | null;
  position: EmployeePosition;
  employmentType: EmploymentType;
  hireDate: string | null;
  yearsOfService: number;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
};

export const EMPLOYEE_POSITION_LABEL: Record<EmployeePosition, string> = {
  STAFF: '사원',
  ASSISTANT_MANAGER: '대리',
  MANAGER: '과장',
  SENIOR_MANAGER: '차장',
  DIRECTOR: '부장 이상',
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  P: '정규직',
  E: '계약직',
};

export type LeaveRequest = {
  id: string;
  requesterId: string;
  requesterName: string;
  teamId: string | null;
  teamName: string | null;
  requestType: RequestType;
  startDate: string;
  endDate: string;
  halfDay: HalfDay;
  reason: string | null;
  status: RequestStatus;
  approverId: string | null;
  approverName: string | null;
  approvalStatus: ApprovalStatus | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalItem = LeaveRequest & {
  approvalStepId: string;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  targetType: string | null;
  targetId: string | null;
  readAt: string | null;
  createdAt: string;
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  ANNUAL: '연차',
  AM_HALF: '오전 반차',
  PM_HALF: '오후 반차',
  SICK: '병가',
  OFFICIAL: '공가',
  COMP: '대체휴무',
  BUSINESS_TRIP: '출장',
  TRIP_EXPENSE: '출장 여비',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: '임시저장',
  PENDING: '결재 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
  REVOKED: '승인 취소',
};
