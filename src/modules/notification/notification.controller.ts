import type { Request, Response } from "express";
import { NotificationService } from "./notification.service";

export class NotificationController {
  static async getByAvitag(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const result = await NotificationService.getNotificationsByAvitag(avitag);
    return res.status(result.status || 200).json(result);
  }

  static async markAsRead(req: Request, res: Response) {
    const { notificationId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await NotificationService.markAsRead(notificationId || "", avitag);
    return res.status(result.status || 200).json(result);
  }
}
