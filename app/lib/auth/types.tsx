export type Role = "HEAD" | "ADMIN" | "OPERATOR" | "VIEWER";

export type Me = {
    id: string;
    name: string;
    role: Role;
};
