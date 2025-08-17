export type AuthProvider = "Email" | "Google" | "Facebook" | "Apple";
export type AccountStatus = "Active" | "Deleted" | "Suspended";

export interface IAccount {
  accountId?: string; // UUID
  email: string;
  passwordHash?: string | null;
  authProvider: AuthProvider;
  isOtpVerified?: boolean;
  accountStatus?: AccountStatus;
  oauthId?: string | null;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
