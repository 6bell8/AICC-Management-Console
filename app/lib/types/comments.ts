export const COMMENT_TARGET_TYPES = ['NOTICE', 'FAMILY_EVENT', 'AUTHOR_GUIDE'] as const;

export type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number];

export type PostComment = {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  parentId: string | null;
  content: string;
  authorId: string | null;
  authorName: string;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
};
