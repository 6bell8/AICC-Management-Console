export type Role = "ADMIN" | "OPERATOR" | "VIEWER";

export type Me = {
    id: string;
    name: string;
    role: Role;
};
