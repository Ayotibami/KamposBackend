import os
from celery import Celery
from django.conf import settings

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kampos.settings')

# Create the Celery app
app = Celery('kampos')

# Configure Celery using Django settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

# Configure periodic tasks
app.conf.beat_schedule = {
    'check-trending-gists': {
        'task': 'notifications.tasks.check_trending_gists',
        'schedule': 3600.0,  # Run every hour (in seconds)
    },
} 