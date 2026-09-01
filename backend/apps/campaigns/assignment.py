"""Deterministic weighted A/B variant assignment.

A visitor is mapped to a variant by hashing (campaign_id, visitor_id) into the
cumulative-weight range of the campaign's active variants. Same visitor ->
same variant (sticky), with no stored state, so stats are reproducible.
"""
import hashlib


def _bucket(campaign_id, visitor_id, total):
    seed = f"{campaign_id}:{visitor_id}".encode()
    h = int(hashlib.sha256(seed).hexdigest()[:8], 16)
    return h % total


def assign(campaign_id, visitor_id, variants):
    """variants: iterable of objects with .weight and .active. Returns the
    chosen variant, or None when there are no active weighted variants."""
    active = [v for v in variants if v.active and v.weight > 0]
    if not active:
        return None
    total = sum(v.weight for v in active)
    point = _bucket(campaign_id, visitor_id, total)
    upto = 0
    for v in active:
        upto += v.weight
        if point < upto:
            return v
    return active[-1]
