from django.contrib.auth.backends import BaseBackend
from .models import Account

class AccountBackend(BaseBackend):
    def authenticate(self, request, email=None, password=None, **kwargs):
        try:
            account = Account.objects.get(email=email)
            if account.check_password(password):
                return account
        except Account.DoesNotExist:
            return None

    def get_user(self, user_id):
        try:
            return Account.objects.get(account_id=user_id)
        except Account.DoesNotExist:
            return None 