import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { NotificationController } from './notification.controller';

const router = Router();

router.get('/', isAuth, NotificationController.list);
router.get('/unread-count', isAuth, NotificationController.unreadCount);
router.post('/:notification_id/read', isAuth, NotificationController.markRead);
router.post('/read-all', isAuth, NotificationController.markAllRead);
router.get('/preferences', isAuth, NotificationController.getPreferences);
router.put('/preferences', isAuth, NotificationController.setPreferences);

export default router;
