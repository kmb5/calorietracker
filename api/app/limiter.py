"""Shared SlowAPI limiter instance — import this everywhere instead of creating new ones."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
