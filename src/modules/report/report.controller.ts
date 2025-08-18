import type { Request, Response } from "express";
import { ReportService } from "./report.service";

export class ReportController {
  static async create(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const result = await ReportService.createReport(avitag, req.body);
    return res.status(result.status || 201).json(result);
  }

  static async getById(req: Request, res: Response) {
    const { reportId } = req.params;
    const result = await ReportService.getReportById(reportId || "");
    return res.status(result.status || 200).json(result);
  }

  static async getByGistId(req: Request, res: Response) {
    const { gistId } = req.params;
    const result = await ReportService.getReportsByGistId(gistId || "");
    return res.status(result.status || 200).json(result);
  }

  static async update(req: Request, res: Response) {
    const { reportId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await ReportService.updateReport(
      reportId || "",
      avitag,
      req.body
    );
    return res.status(result.status || 200).json(result);
  }
}
