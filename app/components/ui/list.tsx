import * as React from "react";
import { cn } from "./utils";

/** 일반 UL 리스트 */
export function List({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
    return <ul className={cn("list-disc pl-5 text-sm", className)} {...props} />;
}

export function ListItem({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
    return <li className={cn("leading-6", className)} {...props} />;
}

/** 키/값 형태(정의형 리스트) */
export function KVList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("space-y-2 text-sm", className)} {...props} />;
}

export function KVRow({
                          label,
                          value,
                          className,
                      }: {
    label: React.ReactNode;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex items-start justify-between gap-3", className)}>
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right">{value}</span>
        </div>
    );
}
