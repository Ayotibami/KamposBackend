export type GistEntityType = "GIST";

export interface IGist {
  gistId?: string;
  gistText: string;
  avitag: string;
  createdAt?: string;
  editedAt?: string | null;
  gistApproval?: boolean;
}
