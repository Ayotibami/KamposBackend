import os
import sys
from django.utils.autoreload import (
    BaseReloader,
    StatReloader,
    WatchmanReloader,
    get_reloader,
)

class CustomReloader(BaseReloader):
    def watch_dir(self, path, glob):
        if any(pattern.match(path) for pattern in self.ignore_patterns):
            return
        super().watch_dir(path, glob)

    def watch_file(self, path):
        if any(pattern.match(path) for pattern in self.ignore_patterns):
            return
        super().watch_file(path)

def run_with_reloader(main_func, *args, **kwargs):
    reloader = get_reloader()
    if os.environ.get('DJANGO_USE_WATCHMAN', '').lower() in ('true', '1', 'yes'):
        reloader = WatchmanReloader()
    else:
        reloader = StatReloader()
    
    reloader.ignore_patterns = [
        re.compile(pattern) for pattern in getattr(settings, 'DJANGO_AUTORELOAD_IGNORE', [])
    ]
    
    return reloader.run(main_func, *args, **kwargs) 