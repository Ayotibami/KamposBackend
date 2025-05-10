from celery import shared_task
from django.db.models import Count, Q
from django.utils import timezone
from gist.models import Gist
from .services import NotificationService

@shared_task
def check_trending_gists():
    """
    Check for trending gists every hour.
    A gist is considered trending if it has:
    - At least 10 total engagements (reactions + comments)
    - At least 5 engagements in the last hour
    """
    now = timezone.now()
    hour_ago = now - timezone.timedelta(hours=1)

    # Get gists with significant recent activity
    trending_gists = Gist.objects.annotate(
        total_engagement=Count('reactions') + Count('comments'),
        recent_engagement=Count(
            'reactions',
            filter=Q(reactions__created_at__gte=hour_ago)
        ) + Count(
            'comments',
            filter=Q(comments__commented_at__gte=hour_ago)
        )
    ).filter(
        total_engagement__gte=10,
        recent_engagement__gte=5
    )

    for gist in trending_gists:
        NotificationService.notify_trending_gist(gist)

@shared_task
def cleanup_old_notifications():
    """Clean up notifications older than 30 days"""
    from .models import Notification
    thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
    Notification.objects.filter(
        created_at__lt=thirty_days_ago,
        is_read=True
    ).delete() 