from django.db import models

class Major(models.Model):
    major_name = models.CharField(max_length=255, unique=True)
    major_tag = models.CharField(max_length=10, unique=True)
    
    class Meta:
        ordering = ['major_name']
    
    def __str__(self):
        return f"{self.major_name} ({self.major_tag})" 