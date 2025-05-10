from django.core.management.base import BaseCommand
from django.utils import timezone
from notifications.models import Notification

class Command(BaseCommand):
    help = 'Clean up old notifications'

    def handle(self, *args, **kwargs):
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        old_notifications = Notification.objects.filter(
            created_at__lt=thirty_days_ago,
            is_read=True
        )
        count = old_notifications.count()
        old_notifications.delete()
        self.stdout.write(
            self.style.SUCCESS(f'Successfully deleted {count} old notifications')
        ) 