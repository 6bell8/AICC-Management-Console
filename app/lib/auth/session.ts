import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

import { getUserById, type AuthUser, withoutPassword } from '../db/users';

const COOKIE_NAME = 'aicc_session';
const ONE_DAY_SECONDS = 60 * 60 * 24;

type SessionPayload = {
  sub: string;
  email: string;
  role: AuthUser['role'];
  status: AuthUser['status'];
  exp: number;
};

function getSecret() {
  return process.env.AUTH_SESSION_SECRET || 'dev-only-change-this-secret';
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function sign(data: string) {
  return createHmac('sha256', getSecret()).update(data).digest('base64url');
}

function verifySignature(data: string, signature: string) {
  const expected = sign(data);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function createSessionToken(user: AuthUser) {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    exp: Math.floor(Date.now() / 1000) + ONE_DAY_SECONDS,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function parseSessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature || !verifySignature(encoded, signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: AuthUser) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_DAY_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const payload = parseSessionToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!payload) return null;

  const user = await getUserById(payload.sub);
  if (!user || user.status !== 'APPROVED') return null;
  return withoutPassword(user);
}

export { COOKIE_NAME };
