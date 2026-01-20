"""
i18n Module - Internationalization for LittleFounders Backend

This module provides a centralized system for handling translatable messages
in the backend. It supports multiple languages and provides a clean interface
for retrieving localized messages.

Usage:
    from i18n import get_message, MessageCode
    
    # Get a message in the default language (Spanish)
    msg = get_message(MessageCode.LOGIN_SUCCESS)
    
    # Get a message in a specific language
    msg = get_message(MessageCode.LOGIN_SUCCESS, "en")
"""

from .messages import MessageCode, get_message, get_language_from_header, SUPPORTED_LANGUAGES

__all__ = [
    "MessageCode",
    "get_message", 
    "get_language_from_header",
    "SUPPORTED_LANGUAGES",
]
