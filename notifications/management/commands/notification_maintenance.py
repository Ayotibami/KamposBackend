from django.core.management.base import BaseCommand
from django.utils import timezone
from notifications.models import Notification

class Command(BaseCommand):
    help = 'Perform notification system maintenance'

    def handle(self, *args, **kwargs):
        # Clean up old notifications
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        deleted_count = Notification.objects.filter(
            created_at__lt=thirty_days_ago,
            is_read=True
        ).delete()[0]

        self.stdout.write(
            self.style.SUCCESS(
                f'Maintenance complete. Deleted {deleted_count} old notifications'
            )
        ) 