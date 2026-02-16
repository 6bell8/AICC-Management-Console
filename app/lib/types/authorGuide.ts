export type AuthorGuide = {
  id: string;
  title: string;
  content?: string | null;
  status?: string | null; // notice처럼 유연하게
  updatedAt?: string | null;
  createdAt?: string | null;
};

