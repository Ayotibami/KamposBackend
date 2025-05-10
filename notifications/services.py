from django.db.models import Count
from django.utils import timezone
from .models import Notification
from gist.models import Gist

class NotificationService:
    @staticmethod
    def create_notification(avi_tag, type, message, reference_id=None):
        return Notification.objects.create(
            avi_tag=avi_tag,
            type=type,
            message=message,
            reference_id=reference_id
        )

    @staticmethod
    def notify_gist_reaction(gist, reactor_avitag, reaction_type):
        if gist.avitag != reactor_avitag:  # Don't notify self-reactions
            message = f"{reactor_avitag} reacted with {reaction_type} to your gist"
            NotificationService.create_notification(
                avi_tag=gist.avitag,
                type='GIST_LIKE',
                message=message,
                reference_id=gist.gist_id
            )

    @staticmethod
    def notify_gist_comment(gist, commenter_avitag):
        if gist.avitag != commenter_avitag:  # Don't notify self-comments
            message = f"{commenter_avitag} commented on your gist"
            NotificationService.create_notification(
                avi_tag=gist.avitag,
                type='GIST_COMMENT',
                message=message,
                reference_id=gist.gist_id
            )

    @staticmethod
    def notify_trending_gist(gist):
        # Check if gist has high engagement (e.g., > 10 reactions + comments)
        engagement_threshold = 10
        engagement_count = (
            gist.reactions.count() +
            gist.comments.count()
        )
        
        if engagement_count >= engagement_threshold:
            message = f"Your gist is trending with {engagement_count} engagements!"
            NotificationService.create_notification(
                avi_tag=gist.avitag,
                type='NEW_GIST',
                message=message,
                reference_id=gist.gist_id
            )

    @staticmethod
    def notify_same_major_gist(gist, creator_profile):
        # Get all users with same major
        from account.models import Profile  # Import here to avoid circular import
        same_major_users = Profile.objects.filter(
            major_tag=creator_profile.major_tag
        ).exclude(avitag=creator_profile.avitag)

        for user in same_major_users:
            message = f"New gist from {gist.avitag} in your major"
            NotificationService.create_notification(
                avi_tag=user.avitag,
                type='MAJOR_GIST',
                message=message,
                reference_id=gist.gist_id
            )

    @staticmethod
    def notify_same_institution_gist(gist, creator_profile):
        # Get all users from same institution
        from account.models import Profile  # Import here to avoid circular import
        same_institution_users = Profile.objects.filter(
            campus_tag=creator_profile.campus_tag
        ).exclude(avitag=creator_profile.avitag)

        for user in same_institution_users:
            message = f"New gist from {gist.avitag} in your institution"
            NotificationService.create_notification(
                avi_tag=user.avitag,
                type='INSTITUTION_GIST',
                message=message,
                reference_id=gist.gist_id
            ) 