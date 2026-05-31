"""
Centralized Message System for LittleFounders Backend

This module defines all translatable messages used in API responses,
error handling, and user-facing content. Messages are organized by
category and support multiple languages.

Supported Languages:
- es: Spanish (default)
- en: English

Adding a new message:
1. Add a new enum value to MessageCode
2. Add translations in both MESSAGES_ES and MESSAGES_EN dictionaries

Adding a new language:
1. Create a new MESSAGES_{LANG} dictionary
2. Add translations for all MessageCode values
3. Add the language to MESSAGES and SUPPORTED_LANGUAGES
"""
from __future__ import annotations

from enum import Enum


class MessageCode(str, Enum):
    """
    Enum of all message codes used throughout the application.
    Organized by category for easier maintenance.
    """

    # Authentication
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT_SUCCESS = "LOGOUT_SUCCESS"
    REGISTER_SUCCESS = "REGISTER_SUCCESS"
    REGISTER_FAILED = "REGISTER_FAILED"
    EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    UNAUTHORIZED = "UNAUTHORIZED"
    ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE"

    # User Management
    USER_NOT_FOUND = "USER_NOT_FOUND"
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    PROFILE_UPDATED = "PROFILE_UPDATED"

    # Lessons
    LESSON_NOT_FOUND = "LESSON_NOT_FOUND"
    LESSON_COMPLETED = "LESSON_COMPLETED"
    LESSON_PROGRESS_SAVED = "LESSON_PROGRESS_SAVED"

    # Generic
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    NOT_FOUND = "NOT_FOUND"
    BAD_REQUEST = "BAD_REQUEST"
    SERVER_ERROR = "SERVER_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"


# Spanish messages (default)
MESSAGES_ES = {
    # Authentication
    MessageCode.LOGIN_SUCCESS: "¡Inicio de sesión exitoso!",
    MessageCode.LOGIN_FAILED: "Error al iniciar sesión",
    MessageCode.LOGOUT_SUCCESS: "Sesión cerrada correctamente",
    MessageCode.REGISTER_SUCCESS: "¡Registro exitoso!",
    MessageCode.REGISTER_FAILED: "Error al registrar usuario",
    MessageCode.EMAIL_ALREADY_EXISTS: "Este correo ya está registrado",
    MessageCode.INVALID_CREDENTIALS: "Correo o contraseña incorrectos",
    MessageCode.SESSION_EXPIRED: "Tu sesión ha expirado. Inicia sesión nuevamente.",
    MessageCode.UNAUTHORIZED: "No tienes permiso para acceder a este recurso",
    MessageCode.ACCOUNT_INACTIVE: "Tu cuenta está inactiva",

    # User Management
    MessageCode.USER_NOT_FOUND: "Usuario no encontrado",
    MessageCode.USER_CREATED: "Usuario creado exitosamente",
    MessageCode.USER_UPDATED: "Usuario actualizado",
    MessageCode.USER_DELETED: "Usuario eliminado",
    MessageCode.PROFILE_UPDATED: "Perfil actualizado correctamente",

    # Lessons
    MessageCode.LESSON_NOT_FOUND: "Lección no encontrada",
    MessageCode.LESSON_COMPLETED: "¡Lección completada!",
    MessageCode.LESSON_PROGRESS_SAVED: "Progreso guardado",

    # Generic
    MessageCode.SUCCESS: "Operación exitosa",
    MessageCode.ERROR: "Error",
    MessageCode.NOT_FOUND: "No encontrado",
    MessageCode.BAD_REQUEST: "Solicitud inválida",
    MessageCode.SERVER_ERROR: "Error del servidor",
    MessageCode.VALIDATION_ERROR: "Error de validación",
}

# English messages
MESSAGES_EN = {
    # Authentication
    MessageCode.LOGIN_SUCCESS: "Login successful!",
    MessageCode.LOGIN_FAILED: "Login failed",
    MessageCode.LOGOUT_SUCCESS: "Logged out successfully",
    MessageCode.REGISTER_SUCCESS: "Registration successful!",
    MessageCode.REGISTER_FAILED: "Registration failed",
    MessageCode.EMAIL_ALREADY_EXISTS: "This email is already registered",
    MessageCode.INVALID_CREDENTIALS: "Invalid email or password",
    MessageCode.SESSION_EXPIRED: "Your session has expired. Please log in again.",
    MessageCode.UNAUTHORIZED: "You don't have permission to access this resource",
    MessageCode.ACCOUNT_INACTIVE: "Your account is inactive",

    # User Management
    MessageCode.USER_NOT_FOUND: "User not found",
    MessageCode.USER_CREATED: "User created successfully",
    MessageCode.USER_UPDATED: "User updated",
    MessageCode.USER_DELETED: "User deleted",
    MessageCode.PROFILE_UPDATED: "Profile updated successfully",

    # Lessons
    MessageCode.LESSON_NOT_FOUND: "Lesson not found",
    MessageCode.LESSON_COMPLETED: "Lesson completed!",
    MessageCode.LESSON_PROGRESS_SAVED: "Progress saved",

    # Generic
    MessageCode.SUCCESS: "Operation successful",
    MessageCode.ERROR: "Error",
    MessageCode.NOT_FOUND: "Not found",
    MessageCode.BAD_REQUEST: "Invalid request",
    MessageCode.SERVER_ERROR: "Server error",
    MessageCode.VALIDATION_ERROR: "Validation error",
}

# Combined messages dictionary
MESSAGES = {
    "es": MESSAGES_ES,
    "en": MESSAGES_EN,
}

# List of supported languages
SUPPORTED_LANGUAGES = ["es", "en"]

# Default language
DEFAULT_LANGUAGE = "es"


def get_message(code: MessageCode, lang: str | None = None) -> str:
    """
    Get a translated message by its code.
    
    Args:
        code: The MessageCode enum value
        lang: Language code ('es' or 'en'). Defaults to Spanish.
    
    Returns:
        The translated message string
    
    Example:
        >>> get_message(MessageCode.LOGIN_SUCCESS)
        '¡Inicio de sesión exitoso!'
        >>> get_message(MessageCode.LOGIN_SUCCESS, 'en')
        'Login successful!'
    """
    if lang is None:
        lang = DEFAULT_LANGUAGE

    # Normalize language code (e.g., "es-MX" -> "es")
    lang = lang.split("-")[0].lower()

    # Fallback to default if language not supported
    if lang not in SUPPORTED_LANGUAGES:
        lang = DEFAULT_LANGUAGE

    # Get the message, with fallback to English, then to the code itself
    messages = MESSAGES.get(lang, MESSAGES_ES)
    return messages.get(code, MESSAGES_EN.get(code, str(code)))


def get_language_from_header(accept_language: str | None) -> str:
    """
    Extract language code from Accept-Language header.
    
    Args:
        accept_language: The Accept-Language header value
                        e.g., "es-MX,es;q=0.9,en;q=0.8"
    
    Returns:
        The primary language code ('es' or 'en')
    
    Example:
        >>> get_language_from_header("es-MX,es;q=0.9,en;q=0.8")
        'es'
        >>> get_language_from_header("en-US,en;q=0.9")
        'en'
    """
    if not accept_language:
        return DEFAULT_LANGUAGE

    # Parse the primary language from the header
    primary_lang = accept_language.split(",")[0].split("-")[0].lower()

    # Return the language if supported, otherwise default
    return primary_lang if primary_lang in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE
