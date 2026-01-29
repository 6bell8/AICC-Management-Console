// lib/auth/storage.ts
export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER';

const KEY_TOKEN = 'aicc.token';
const KEY_ROLE = 'aicc.role';

export const authStorage = {
  setSession(token: string, role: Role) {
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_ROLE, role);
  },

  getToken(): string | null {
    return localStorage.getItem(KEY_TOKEN);
  },

  getSession(): { token: string; role: Role } | null {
    const token = localStorage.getItem(KEY_TOKEN);
    const role = localStorage.getItem(KEY_ROLE) as Role | null;
    if (!token) return null;
    // role이 없으면 기본값을 주거나 null 처리(원하시는 정책대로)
    return { token, role: role ?? 'VIEWER' };
  },

  clear() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_ROLE);
  },
};
