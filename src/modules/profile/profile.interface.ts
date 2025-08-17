export type ProfileType = "STUDENT" | "KAMPOSER" | "CREATOR" | "ADMIN" | "SCHOOL";

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