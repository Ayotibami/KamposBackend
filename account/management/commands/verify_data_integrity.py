from django.core.management.base import BaseCommand
from account.models import Profile
from events.models import Event
import json

class Command(BaseCommand):
    help = 'Verify and fix data integrity for Profile and Event models'

    def handle(self, *args, **options):
        # Check Profile hobbies
        for profile in Profile.objects.all():
            if profile.hobbies:
                try:
                    # Ensure it's in correct format
                    profile.hobbies_list = profile.hobbies_list
                    profile.save()
                    self.stdout.write(f'Fixed hobbies for profile {profile.avitag}')
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error with profile {profile.avitag}: {str(e)}'))

        # Check Event host_avi_tags
        for event in Event.objects.all():
            try:
                # Ensure it's valid JSON
                tags = event.host_avi_tags
                event.host_avi_tags = tags
                event.save()
                self.stdout.write(f'Fixed host_avi_tags for event {event.event_id}')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error with event {event.event_id}: {str(e)}')) 