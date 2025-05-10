from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Count
from django.utils import timezone
from gist.models import Gist, Comment, Reaction
from .services import NotificationService

@receiver(post_save, sender=Reaction)
def handle_reaction_notification(sender, instance, created, **kwargs):
    """Handle notifications when a reaction is created"""
    if created and instance.entity_type == 'GIST':
        try:
            gist = Gist.objects.get(gist_id=instance.entity_id)
            NotificationService.notify_gist_reaction(
                gist,
                instance.avitag,
                instance.type
            )
            
            # Check if gist is trending
            check_if_trending(gist)
        except Gist.DoesNotExist:
            pass

@receiver(post_save, sender=Comment)
def handle_comment_notification(sender, instance, created, **kwargs):
    """Handle notifications when a comment is created"""
    if created:
        NotificationService.notify_gist_comment(
            instance.gist,
            instance.avitag
        )
        
        # Check if gist is trending
        check_if_trending(instance.gist)

@receiver(post_save, sender=Gist)
def handle_gist_creation(sender, instance, created, **kwargs):
    """Handle notifications when a gist is created"""
    if created:
        from account.models import Profile
        try:
            creator_profile = Profile.objects.get(avitag=instance.avitag)
            NotificationService.notify_same_major_gist(instance, creator_profile)
            NotificationService.notify_same_institution_gist(instance, creator_profile)
        except Profile.DoesNotExist:
            pass

def check_if_trending(gist):
    """Check if a gist has become trending"""
    # Get engagement counts
    reaction_count = Reaction.objects.filter(
        entity_type='GIST',
        entity_id=gist.gist_id
    ).count()
    
    comment_count = Comment.objects.filter(gist=gist).count()
    total_engagement = reaction_count + comment_count

    # Check recent engagement (last hour)
    hour_ago = timezone.now() - timezone.timedelta(hours=1)
    recent_reactions = Reaction.objects.filter(
        entity_type='GIST',
        entity_id=gist.gist_id,
        created_at__gte=hour_ago
    ).count()
    
    recent_comments = Comment.objects.filter(
        gist=gist,
        commented_at__gte=hour_ago
    ).count()
    recent_engagement = recent_reactions + recent_comments

    # If trending criteria met, send notification
    if total_engagement >= 10 and recent_engagement >= 5:
        NotificationService.notify_trending_gist(gist) 