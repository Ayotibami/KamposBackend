export type MediaEntityType = "gist" | "event";
export type MediaType = "image" | "video";

export interface IMedia {
  mediaId?: string; // UUID
  entityType: MediaEntityType;
  entityId: string;
  mediaType: MediaType;
  mediaUrl: string;
  uploadedAt?: string;
  editedAt?: string | null;
  thumbnailUrl?: string | null;
}
