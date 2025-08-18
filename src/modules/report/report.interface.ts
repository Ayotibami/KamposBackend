export type ReportStatus =
  | "PENDING"
  | "REVIEWED"
  | "ACTION_TAKEN"
  | "DISMISSED";

export interface IReport {
  reportId?: string; // UUID
  reportedBy: string;
  gistId: string;
  reason: string;
  status?: ReportStatus;
  actionTaken?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
}
