import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listRoomReservationSnapshot } from '@/app/lib/db/roomReservations';

import RoomReservationsClient from './RoomReservationsClient';

export const dynamic = 'force-dynamic';

function toDateKey(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRange(dateKey: string) {
  const base = new Date(`${dateKey}T00:00:00`);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { startDate: toDateKey(start), endDate: toDateKey(end) };
}

export default async function ReservationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/reservations');

  const today = new Date().toISOString().slice(0, 10);
  const weekRange = getWeekRange(today);
  const initialData = await listRoomReservationSnapshot({ date: today, ...weekRange });

  return <RoomReservationsClient initialData={initialData} currentUser={user} initialDate={today} />;
}
