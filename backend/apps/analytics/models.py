from django.db import models


class Click(models.Model):
    public_id = models.CharField(max_length=16, db_index=True)
    ts = models.DateTimeField(db_index=True)
    verdict = models.CharField(max_length=10)   # money | white
    reason = models.CharField(max_length=64, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    country = models.CharField(max_length=2, blank=True)
    device = models.CharField(max_length=16, blank=True)
    user_agent = models.TextField(blank=True)
    is_headless = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-ts"]
        indexes = [models.Index(fields=["public_id", "ts"])]
