"use client";

import { useMemo } from "react";
import { authStorage } from "./storage";
import type { Me, Role } from "./types";

export function useMe() {
    // MVP: localStorage를 읽어서 me를 "만들어내는" 모킹
    const token = authStorage.getToken();
    const role = authStorage.getRole();

    const me: Me | null = useMemo(() => {
        if (!token || !role) return null;
        return { id: "me_mock", name: "봉춘", role: role as Role };
    }, [token, role]);

    return { me, isAuthed: !!me };
}
