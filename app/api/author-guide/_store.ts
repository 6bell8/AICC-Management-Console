export type AuthorGuide = {
  id: string;
  title: string;
  content?: string;
  status: 'PUBLISHED' | 'DRAFT';
  createdAt: string;
  updatedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __AUTHOR_GUIDE_DB__: AuthorGuide[] | undefined;
}

export const DB: AuthorGuide[] = globalThis.__AUTHOR_GUIDE_DB__ ?? (globalThis.__AUTHOR_GUIDE_DB__ = []);
