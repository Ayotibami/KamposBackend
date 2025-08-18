export interface IComment {
  commentId?: string; // UUID
  gistId: string;
  avitag: string;
  text: string;
  commentedAt?: string;
}
