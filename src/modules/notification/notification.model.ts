import pool from "../../config/connectDB";
import type { INotification } from "./notification.interface";

const mapRow = (r: any): INotification => ({
  notificationId: r.notification_id,
  avitag: r.avitag,
  type: r.type,
  message: r.message,
  referenceId: r.reference_id,
  isRead: r.is_read,
  createdAt: r.created_at,
});

export const createNotification = async (
  notification: Partial<INotification>
): Promise<INotification> => {
  const { rows } = await pool.query(
    `INSERT INTO notifications (avitag, type, message, reference_id, is_read)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      notification.avitag,
      notification.type,
      notification.message,
      notification.referenceId ?? null,
      notification.isRead ?? false,
    ]
  );
  return mapRow(rows[0]);
};

export const findNotificationsByAvitag = async (
  avitag: string
): Promise<INotification[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE avitag = $1 ORDER BY created_at DESC`,
    [avitag]
  );
  return rows.map(mapRow);
};

export const markNotificationAsRead = async (
  notificationId: string,
  avitag: string
): Promise<INotification | null> => {
  const { rows } = await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND avitag = $2 RETURNING *`,
    [notificationId, avitag]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};
