from django.db import models

class Campus(models.Model):
    campus_name = models.CharField(max_length=255, unique=True)
    campus_tag = models.CharField(max_length=10, unique=True)
    
    class Meta:
        verbose_name_plural = "Campuses"
        ordering = ['campus_name']
    
    def __str__(self):
        return f"{self.campus_name} ({self.campus_tag})" 