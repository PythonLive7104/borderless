from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.organizations.models import Organization
from datetime import timedelta
from django.utils import timezone
from .models import Subscription, Plan, TRIAL_DAYS


@receiver(post_save, sender=Organization)
def ensure_subscription(sender, instance, created, **kwargs):
    if not created:
        return
    default_plan = Plan.objects.filter(slug="basic").first()
    if default_plan:
        Subscription.objects.get_or_create(
            organization=instance,
            defaults={"plan": default_plan, "trial_end": timezone.now() + timedelta(days=TRIAL_DAYS)},
        )
