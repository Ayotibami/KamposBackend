from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from .models import Event, EventRegistration


class EventTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
    