"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function Providers({ children }: { children: React.ReactNode }) {
    const [client] = React.useState(() => new QueryClient()); // 렌더마다 새 QueryClient 생성되는 거 방지

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
