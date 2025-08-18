import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as notificationRepo from "./notification.model";
import * as profileRepo from "../profile/profile.model";
import type { INotification } from "./notification.interface";
import { WebSocketService } from "../../services/websocket.service.ts";

export class NotificationService {
  static async createNotification(notification: Partial<INotification>) {
    const profile = await profileRepo.findProfileByAvitag(notification.avitag!);
    if (!profile) throw ApiError.notFound("Profile not found");
    const created = await notificationRepo.createNotification(notification);
    WebSocketService.sendNotification(notification.avitag!, created);
    return ApiSuccess.created("Notification created", created);
  }

  static async getNotificationsByAvitag(avitag: string) {
    const notifications = await notificationRepo.findNotificationsByAvitag(
      avitag
    );
    return ApiSuccess.ok("Notifications fetched", notifications);
  }

  static async markAsRead(notificationId: string, avitag: string) {
    const notification = await notificationRepo.markNotificationAsRead(
      notificationId,
      avitag
    );
    if (!notification) throw ApiError.notFound("Notification not found");
    return ApiSuccess.ok("Notification marked as read", notification);
  }
}
