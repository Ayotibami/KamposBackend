export type ReactionEntityType = "GIST" | "COMMENT";
export type ReactionType = "LIKE" | "LOVE" | "FIRE" | "SAD" | "WOW";

export interface IReaction {
  reactionId?: string; // UUID
  avitag: string;
  entityType: ReactionEntityType;
  entityId: string;
  type: ReactionType;
  createdAt?: string;
}
