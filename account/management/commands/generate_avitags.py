from django.core.management.base import BaseCommand
from account.models import Account, Profile

class Command(BaseCommand):
    help = 'Generate avitags for accounts that don\'t have one'

    def handle(self, *args, **options):
        accounts = Account.objects.all()
        for account in accounts:
            try:
                profile = Profile.objects.get(account_id=account.account_id)
                if not profile.avitag:
                    profile.avitag = Profile.generate_avitag(account.first_name, account.last_name)
                    profile.save()
                    self.stdout.write(f"Generated avitag for {account.email}: {profile.avitag}")
            except Profile.DoesNotExist:
                # Create new profile with avitag
                profile = Profile.create_profile(account)
                self.stdout.write(f"Created profile with avitag for {account.email}: {profile.avitag}") 