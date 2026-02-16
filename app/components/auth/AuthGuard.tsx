"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "../../lib/auth/useMe";
import type { Role } from "../../lib/auth/types";

function NoAccess() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-sm">
                <p className="text-sm font-medium">권한이 없습니다.</p>
                <p className="mt-1 text-xs text-black/60">접근 가능한 역할이 아니에요.</p>
            </div>
        </div>
    );
}

export function AuthGuard({
                              children,
                              allowRoles,
                          }: {
    children: React.ReactNode;
    allowRoles?: Role[]; // 미지정이면 로그인만 체크
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { me, isAuthed } = useMe();

    useEffect(() => {
        if (!isAuthed) {
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
    }, [isAuthed, router, pathname]);

    if (!isAuthed) return null; // 리다이렉트 중

    if (allowRoles && me && !allowRoles.includes(me.role)) {
        return <NoAccess />;
    }

    return <>{children}</>;
}
