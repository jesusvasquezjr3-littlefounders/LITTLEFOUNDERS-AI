"""
backend/admin/error_messages.py
Utilidad para formatear errores de validación de manera bilingüe.
"""
from typing import List, Dict, Any


def format_validation_error_response(errors_es: List[str], errors_en: List[str]) -> Dict[str, Any]:
    """
    Formatea errores de validación de ejercicios en ambos idiomas.

    Args:
        errors_es: Lista de errores en español
        errors_en: Lista de errores en inglés

    Returns:
        Diccionario con estructura:
        {
            "status": 422,
            "message": "Validation errors found",
            "errors": {
                "es": [...],
                "en": [...]
            }
        }
    """
    return {
        "status": 422,
        "message": "Validation errors found" if errors_en else "Errores de validación encontrados",
        "errors": {
            "es": errors_es or [],
            "en": errors_en or []
        }
    }


def translate_error_to_english(error_es: str) -> str:
    """
    Traduce un mensaje de error del español al inglés.

    Args:
        error_es: Mensaje de error en español

    Returns:
        Mensaje de error traducido al inglés
    """
    # Patrones de traducción básicos
    translations = {
        "Falta el campo 'type'": "Missing 'type' field",
        "Falta el campo 'content'": "Missing 'content' field",
        "debe ser un objeto/dict": "must be an object/dict",
        "debe ser un arreglo de ejercicios": "must be an array of exercises",
        "Falta campo requerido en content:": "Missing required field in content:",
        "Tipo de ejercicio no válido:": "Invalid exercise type:",
        "debe tener al menos 2 opciones": "must have at least 2 options",
        "debe tener al menos 2 categorías": "must have at least 2 categories",
        "debe tener al menos 2 elementos": "must have at least 2 elements",
        "Cada opción debe tener 'id' y 'text'": "Each option must have 'id' and 'text'",
        "correct_answer debe tener 'isTrue' (boolean)": "correct_answer must have 'isTrue' (boolean)",
        "Ejercicio #": "Exercise #",
        "Tipos válidos:": "Valid types:",
        "'options'": "'options'",
        "'categories'": "'categories'",
        "'items'": "'items'",
        "'content'": "'content'",
    }

    # Aplicar traducciones
    result = error_es
    for es_text, en_text in translations.items():
        result = result.replace(es_text, en_text)

    return result


def translate_errors_to_english(errors_es: List[str]) -> List[str]:
    """
    Traduce una lista de errores del español al inglés.

    Args:
        errors_es: Lista de errores en español

    Returns:
        Lista de errores traducidos al inglés
    """
    return [translate_error_to_english(error) for error in errors_es]


def format_validation_error_detail(errors_es: List[str], errors_en: List[str]) -> str:
    """
    Formatea el detail string para HTTPException con información bilingüe.

    Args:
        errors_es: Lista de errores en español
        errors_en: Lista de errores en inglés

    Returns:
        String formateado para usar como detail en HTTPException
    """
    es_count = len(errors_es) if errors_es else 0
    en_count = len(errors_en) if errors_en else 0

    if es_count > 0 and en_count > 0:
        return f"Validation errors: {es_count} in Spanish content, {en_count} in English content"
    elif es_count > 0:
        return f"Validation errors in Spanish content: {es_count} error(s)"
    elif en_count > 0:
        return f"Validation errors in English content: {en_count} error(s)"
    else:
        return "Validation errors found"
