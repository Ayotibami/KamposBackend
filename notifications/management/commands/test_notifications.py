from django.core.management.base import BaseCommand
from notifications.tasks import check_trending_gists

class Command(BaseCommand):
    help = 'Test notification system by running trending gist check'

    def handle(self, *args, **kwargs):
        self.stdout.write('Running trending gist check...')
        check_trending_gists.delay()
        self.stdout.write(self.style.SUCCESS('Trending gist check completed')) 