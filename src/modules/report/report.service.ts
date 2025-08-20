import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as reportRepo from "./report.model";
import * as gistRepo from "../gist/gist.model";
import * as profileRepo from "../profile/profile.model";
import type { IReport } from "./report.interface";

export class ReportService {
  static async createReport(avitag: string, reportData: Partial<IReport>) {
    const gist = await gistRepo.findGistById(reportData.gistId!);
    if (!gist) throw ApiError.notFound("Gist not found");
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");
    const report = await reportRepo.createReport({
      ...reportData,
      reportedBy: avitag,
    });
    return ApiSuccess.created("Report created", report);
  }

  static async getReportById(reportId: string) {
    const report = await reportRepo.findReportById(reportId);
    if (!report) throw ApiError.notFound("Report not found");
    return ApiSuccess.ok("Report fetched", report);
  }

  static async getReportsByGistId(gistId: string) {
    const gist = await gistRepo.findGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found");
    const reports = await reportRepo.findReportsByGistId(gistId);
    return ApiSuccess.ok("Reports fetched", reports);
  }

  static async updateReport(
    reportId: string,
    avitag: string,
    updates: Partial<IReport>
  ) {
    const report = await reportRepo.findReportById(reportId);
    if (!report) throw ApiError.notFound("Report not found");
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profile_type !== "ADMIN")
      throw ApiError.forbidden("Only admins can update reports");
    const updated = await reportRepo.updateReportById(reportId, {
      ...updates,
      reviewedBy: avitag,
    });
    if (!updated) throw ApiError.notFound("Report not found");
    return ApiSuccess.ok("Report updated", updated);
  }
}
