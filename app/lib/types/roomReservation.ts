export const ROOM_RESOURCE_TYPES = ['MEETING_ROOM', 'TRAINING_ROOM'] as const;
export const ROOM_RESERVATION_STATUSES = ['PENDING', 'APPROVED', 'CANCELLED'] as const;

export type RoomResourceType = (typeof ROOM_RESOURCE_TYPES)[number];
export type RoomReservationStatus = (typeof ROOM_RESERVATION_STATUSES)[number];

export type RoomResource = {
  id: string;
  name: string;
  type: RoomResourceType;
  location: string | null;
  capacity: number;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoomReservation = {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: RoomResourceType;
  requesterId: string;
  requesterName: string;
  title: string;
  purpose: string | null;
  startsAt: string;
  endsAt: string;
  status: RoomReservationStatus;
  createdAt: string;
  updatedAt: string;
};

export type RoomReservationSnapshot = {
  resources: RoomResource[];
  reservations: RoomReservation[];
};
