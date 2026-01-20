# Guía de Internacionalización (i18n) - LittleFounders

Esta guía explica cómo utilizar el sistema de internacionalización implementado en LittleFounders.

## Idiomas Soportados

| Código | Idioma | Estado |
|--------|--------|--------|
| `es` | Español | ✅ Activo (predeterminado) |
| `en` | English | 🔄 Preparado (traducciones placeholder) |

---

## Frontend (React)

### Estructura de Archivos

```
frontend/src/i18n/
├── index.ts              # Configuración de i18next
└── locales/
    ├── es/               # Español
    │   ├── common.json   # Textos comunes (botones, labels)
    │   ├── auth.json     # Login, registro
    │   ├── landing.json  # Página de landing
    │   ├── lessons.json  # Motor de lecciones
    │   ├── dashboard.json
    │   └── errors.json
    └── en/               # Inglés (placeholder)
        └── ...
```

### Uso en Componentes

#### Método 1: Hook `useTranslation` (recomendado)

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('common');
  
  return (
    <button>{t('buttons.continue')}</button>
  );
}
```

#### Método 2: Múltiples namespaces

```tsx
import { useTranslation } from 'react-i18next';

function LoginForm() {
  const { t } = useTranslation(['auth', 'common']);
  
  return (
    <>
      <h1>{t('auth:login.title')}</h1>
      <button>{t('common:buttons.submit')}</button>
    </>
  );
}
```

#### Método 3: Con variables/interpolación

```tsx
const { t } = useTranslation('dashboard');

// En el JSON: "welcome": "¡Bienvenido, {{name}}!"
return <h1>{t('welcome', { name: user.name })}</h1>;
```

### Cambiar Idioma

#### Usando el componente LanguageSelector

```tsx
import { LanguageSelector } from '@/components/ui/LanguageSelector';

function Navbar() {
  return (
    <nav>
      {/* ... */}
      <LanguageSelector />
    </nav>
  );
}
```

#### Usando el hook useLanguage

```tsx
import { useLanguage } from '@/hooks/useLanguage';

function Settings() {
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  
  return (
    <div>
      {languages.map(lang => (
        <button 
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
        >
          {lang.flag} {lang.name}
        </button>
      ))}
    </div>
  );
}
```

### Agregar Nuevas Traducciones

1. **Identificar el namespace** correcto (auth, common, lessons, etc.)

2. **Agregar la clave en español** (`es/{namespace}.json`):
   ```json
   {
     "nueva_seccion": {
       "mi_texto": "Mi texto en español"
     }
   }
   ```

3. **Agregar placeholder en inglés** (`en/{namespace}.json`):
   ```json
   {
     "nueva_seccion": {
       "mi_texto": "My text in English"
     }
   }
   ```

4. **Usar en el componente**:
   ```tsx
   const { t } = useTranslation('namespace');
   return <p>{t('nueva_seccion.mi_texto')}</p>;
   ```

---

## Backend (FastAPI)

### Estructura

```
backend/i18n/
├── __init__.py           # Exportaciones del módulo
└── messages.py           # Códigos y traducciones
```

### Uso Básico

```python
from i18n import get_message, MessageCode

# Mensaje en español (predeterminado)
msg = get_message(MessageCode.LOGIN_SUCCESS)
# → "¡Inicio de sesión exitoso!"

# Mensaje en inglés
msg = get_message(MessageCode.LOGIN_SUCCESS, "en")
# → "Login successful!"
```

### Uso en Endpoints

```python
from fastapi import Header
from i18n import get_message, MessageCode, get_language_from_header

@router.post("/login")
async def login(
    credentials: LoginInput,
    accept_language: str = Header(default="es")
):
    lang = get_language_from_header(accept_language)
    
    # ... lógica de login ...
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail=get_message(MessageCode.INVALID_CREDENTIALS, lang)
        )
    
    return {
        "message": get_message(MessageCode.LOGIN_SUCCESS, lang),
        "user": user_data
    }
```

### Agregar Nuevos Mensajes

1. **Agregar código en el enum** (`messages.py`):
   ```python
   class MessageCode(str, Enum):
       # ...
       MI_NUEVO_MENSAJE = "MI_NUEVO_MENSAJE"
   ```

2. **Agregar traducción en español**:
   ```python
   MESSAGES_ES = {
       # ...
       MessageCode.MI_NUEVO_MENSAJE: "Mi mensaje en español",
   }
   ```

3. **Agregar traducción en inglés**:
   ```python
   MESSAGES_EN = {
       # ...
       MessageCode.MI_NUEVO_MENSAJE: "My message in English",
   }
   ```

---

## Convenciones

### ✅ Buenas Prácticas

- **Siempre usar claves descriptivas**: `login.title` en vez de `t1`
- **Agrupar por sección**: `auth.login.button`, `auth.register.button`
- **Usar interpolación** para valores dinámicos: `{{name}}`, `{{count}}`
- **No mezclar idiomas** en las claves de traducción
- **Documentar traducciones complejas** con comentarios

### ❌ Evitar

- Textos hardcodeados en JSX: `<button>Continuar</button>`
- Concatenar strings traducidos: `t('hello') + ' ' + name`
- Traducciones muy largas en una sola clave

---

## Agregar un Nuevo Idioma

### Frontend

1. Crear carpeta `frontend/src/i18n/locales/{codigo}/`
2. Copiar todos los archivos JSON de `es/`
3. Traducir el contenido
4. Agregar en `i18n/index.ts`:
   ```typescript
   import ptCommon from './locales/pt/common.json';
   // ... más imports
   
   const resources = {
     // ... existentes
     pt: {
       common: ptCommon,
       // ... más namespaces
     }
   };
   ```
5. Actualizar `SUPPORTED_LANGUAGES` y `LANGUAGE_NAMES`

### Backend

1. Crear diccionario `MESSAGES_PT` en `messages.py`
2. Agregar todas las traducciones
3. Agregar en `MESSAGES` y `SUPPORTED_LANGUAGES`

---

## Testing

### Verificar que i18n funciona

```tsx
// En cualquier componente
const { i18n } = useTranslation();
console.log('Idioma actual:', i18n.language);
console.log('Idiomas disponibles:', i18n.languages);
```

### Cambiar idioma manualmente (desarrollo)

```javascript
// En la consola del navegador
localStorage.setItem('littlefounders_language', 'en');
location.reload();
```

---

## Recursos

- [react-i18next docs](https://react.i18next.com/)
- [i18next interpolation](https://www.i18next.com/translation-function/interpolation)
