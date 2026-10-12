"""Analytics reads from apps.traffic (Visitor / Session / TrafficEvent / Conversion).

This app deliberately owns no models of its own: the traffic app is the single
source of truth for what happened, and analytics only queries and aggregates it.
"""
