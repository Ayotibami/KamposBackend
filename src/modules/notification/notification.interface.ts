export type NotificationType =
  | "NEW_GIST"
  | "GIST_LIKE"
  | "GIST_COMMENT"
  | "MAJOR_GIST"
  | "INSTITUTION_GIST";

export interface INotification {
  notificationId?: string; // UUID
  avitag: string;
  type: NotificationType;
  message: string;
  referenceId?: string | null;
  isRead?: boolean;
  createdAt?: string;
}
