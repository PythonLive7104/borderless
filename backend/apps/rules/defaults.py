"""The rule every new website starts with.

A customer who adds a site, installs the tracker and sees "Protected" reasonably
assumes bot traffic is being dealt with. It wasn't: Evaluate() returns "allow"
when nothing matches, and a Website carries no default threshold, so a site
whose only rule was `Proxy/VPN is Yes` happily allowed a visitor the engine had
just scored 80 and classified as a bot. The detection was right; nobody had told
it to act. This closes the gap between what "Protected" implies and what it did.

It is an ordinary TrafficRule — editable, disableable, deletable. Nothing here
is special-cased in the engine, which matters: a default the customer cannot
inspect or turn off is worse than no default at all, because the first time it
blocks someone it shouldn't they have no way to find out why.
"""
import logging

from django.conf import settings

log = logging.getLogger("rules")

DEFAULT_RULE_NAME = "Block bot & fraud traffic"

#: Runs AFTER anything the customer writes. Rules are evaluated in priority
#: order and the first match wins, so a high number means their own rules —
#: including any deliberate "allow" — always take precedence over this one.
DEFAULT_RULE_PRIORITY = 500


def default_blocked_url() -> str:
    """Where default-blocked traffic is sent.

    Our own hosted page, so the rule works the moment it is created — the
    customer does not have to build a "blocked" page before their site is
    protected. They can point it anywhere once they have one.
    """
    return f"{settings.FRONTEND_URL.rstrip('/')}/blocked.html"


def create_default_rule(website, force: bool = False):
    """Give a website the default bot rule. Returns it, or None.

    `force` adds it to a site that already has rules of its own. That is the
    case the backfill needs: a site filtering only on VPN or country has rules,
    yet still allows a visitor the engine classified as a bot, because nothing
    acts on the classification.

    Never raises. Adding a website must not fail because a convenience rule
    could not be written.
    """
    from .models import RuleCondition, TrafficRule

    try:
        # On creation, only ever on a site with no rules: the guard means a
        # re-run or a backfill can't silently duplicate it.
        if not force and TrafficRule.objects.filter(website=website).exists():
            return None
        # Even forced, never add a second copy of this same rule.
        if TrafficRule.objects.filter(website=website, name=DEFAULT_RULE_NAME).exists():
            return None

        rule = TrafficRule.objects.create(
            organization=website.organization,
            website=website,
            name=DEFAULT_RULE_NAME,
            priority=DEFAULT_RULE_PRIORITY,
            action=TrafficRule.Action.REDIRECT,
            redirect_url=default_blocked_url(),
            active=True,
        )
        # "bot" AND "fraud": fraud is the more serious verdict of the two, and a
        # default that caught bots while waving fraud through would be a strange
        # thing to ship.
        RuleCondition.objects.create(
            rule=rule, field="classification", operator="in", value="bot,fraud")
        return rule
    except Exception:  # pragma: no cover - defensive
        log.exception("could not create the default rule for website %s", website.pk)
        return None
