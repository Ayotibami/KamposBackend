import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as profileRepo from "./profile.model";
import { addEmailJob } from "../../services/job-queue.service";
import type { IProfile } from "./profile.interface";

export class ProfileService {
  static async createProfile(profileData: Partial<IProfile>) {
    const existingProfile = await profileRepo.findProfileByAvitag(
      profileData.avitag!
    );
    if (existingProfile)
      throw ApiError.forbidden("Profile with this avitag already exists");
    const profile = await profileRepo.createProfile(profileData);

    // Send welcome email
    const account = await (
      await import("../account/account.model")
    ).findAccountById(profileData.account_id!);
    if (account) {
      const displayName =
        (profileData as any).display_name ||
        (profileData as any).first_name ||
        (profileData as any).full_name ||
        "User";
      await addEmailJob({
        to: account.email,
        subject: "Welcome to Kampos!",
        html: `<p>Welcome, ${displayName}!</p><p>Your profile has been created successfully.</p>`,
      });
    }

    return ApiSuccess.created("Profile created", profile);
  }

  static async getProfileByAvitag(avitag: string) {
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");
    return ApiSuccess.ok("Profile fetched", profile);
  }

  static async updateProfile(
    avitag: string,
    updates: Partial<IProfile>,
    requestingAvitag: string
  ) {
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");
    if (
      profile.avitag !== requestingAvitag &&
      profile.profile_type !== "ADMIN"
    ) {
      throw ApiError.forbidden("Not authorized to update this profile");
    }
    const updated = await profileRepo.updateProfile(avitag, updates);
    if (!updated) throw ApiError.notFound("Profile not found");
    return ApiSuccess.ok("Profile updated", updated);
  }

  static async deleteProfile(avitag: string, requestingAvitag: string) {
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");
    if (
      profile.avitag !== requestingAvitag &&
      profile.profile_type !== "ADMIN"
    ) {
      throw ApiError.forbidden("Not authorized to delete this profile");
    }
    const deleted = await profileRepo.deleteProfile(avitag);
    if (!deleted) throw ApiError.notFound("Profile not found");
    return ApiSuccess.ok("Profile deleted");
  }

  static async verifyProfile(avitag: string, requestingAvitag: string) {
    const requestingProfile = await profileRepo.findProfileByAvitag(
      requestingAvitag
    );
    if (!requestingProfile || requestingProfile.profile_type !== "ADMIN") {
      throw ApiError.forbidden("Only admins can verify profiles");
    }
    const verified = await profileRepo.verifyProfile(avitag);
    if (!verified) throw ApiError.notFound("Profile not found");
    return ApiSuccess.ok("Profile verified", verified);
  }

  static async getProfilesByType(
    profile_type: string,
    page: number,
    limit: number
  ) {
    const { profiles, total } = await profileRepo.getProfilesByType(
      profile_type,
      page,
      limit
    );
    return ApiSuccess.ok(`Profiles of type ${profile_type} fetched`, {
      profiles,
      total,
    });
  }
}

export const profileService = ProfileService;
