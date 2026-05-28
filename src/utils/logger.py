"""Logging helper for Dheghom."""

import logging
import os


def get_logger(name: str) -> logging.Logger:
    """Create logger with env-configurable level."""
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    return logging.getLogger(name)
