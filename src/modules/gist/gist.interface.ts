export interface IGist {
  gist_id: string;
  avitag: string;
  gist_text: string;
  media_ids?: string[];
  visibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  created_at: Date;
  edited_at?: Date;
  gist_approval: boolean;
}