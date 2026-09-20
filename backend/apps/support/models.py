"""Inbound messages from the public contact form.

Stored before anything else happens. The notification email to the team is a
convenience; the row is the record, so a mail outage can never lose an enquiry
from someone the site just promised a reply within one business day.
"""
from django.db import models


class ContactMessage(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    company = models.CharField(max_length=160, blank=True)
    message = models.TextField()
    ip = models.GenericIPAddressField(null=True, blank=True)
    handled = models.BooleanField(default=False, help_text="Tick once someone has replied.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.email} — {self.created_at:%Y-%m-%d}"
