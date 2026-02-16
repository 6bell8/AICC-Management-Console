import * as React from "react";
import { cn } from "./utils";

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("h-px w-full bg-border", className)} {...props} />;
}
