export type ProfileType =
  | "STUDENT"
  | "KOMPANY"
  | "SCHOOL"
  | "CREATOR"
  | "ADMIN";

export interface IStudentProfile {
  avitag: string;
  account_id: string;
  first_name: string;
  last_name: string;
  campus_tag?: string;
  major_tag?: string;
  degree?: "Bachelors" | "Masters" | "Phd";
  level?: "100" | "200" | "300" | "400" | "500";
  bio?: string;
  hobbies?: string[];
  profile_picture_url?: string;
  is_verified: boolean;
  profile_type: "STUDENT";
  created_at: Date;
  updated_at: Date;
}

export interface IKompanyProfile {
  avitag: string;
  account_id: string;
  display_name: string;
  email: string;
  phone_number: string;
  description?: string;
  logo_url: string;
  website: string;
  social_links?: Record<string, string>;
  is_verified: boolean;
  profile_type: "KOMPANY";
  created_at: Date;
  updated_at: Date;
}

export interface ISchoolProfile {
  avitag: string;
  account_id: string;
  display_name: string;
  description?: string;
  campus_tag?: string;
  logo_url?: string;
  website?: string;
  is_verified: boolean;
  profile_type: "SCHOOL";
  created_at: Date;
  updated_at: Date;
}

export interface ICreatorProfile {
  avitag: string;
  account_id: string;
  display_name: string;
  description?: string;
  campus_tag?: string;
  profile_image?: string;
  engagement_score: number;
  earnings_balance: number;
  monetization_enabled: boolean;
  top_gist_id?: string;
  is_verified: boolean;
  profile_type: "CREATOR";
  created_at: Date;
  updated_at: Date;
}

export interface IAdminProfile {
  avitag: string;
  account_id: string;
  full_name: string;
  description?: string;
  profile_image?: string;
  role: "SUPER_ADMIN" | "MODERATOR" | "CONTENT_REVIEWER" | "SUPPORT";
  permissions: string[];
  is_verified: boolean;
  profile_type: "ADMIN";
  created_at: Date;
  updated_at: Date;
}

export type IProfile =
  | IStudentProfile
  | IKompanyProfile
  | ISchoolProfile
  | ICreatorProfile
  | IAdminProfile;
