export type ProfileType = "STUDENT" | "KOMPANY" | "SCHOOL" | "CREATOR" | "ADMIN";

export interface IProfile {
  avitag?: string; // UUID
  accountId?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  profileType?: ProfileType;
  campusTag?: string;
  majorTag?: string;
  degree?: string;
  level?: string;
  bio?: string;
  profilePictureUrl?: string;
  isVerified?: boolean;
  socialLinks?: Record<string, string>;
  engagementScore?: number;
  earningsBalance?: number;
  monetizationEnabled?: boolean;
  topGistId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}