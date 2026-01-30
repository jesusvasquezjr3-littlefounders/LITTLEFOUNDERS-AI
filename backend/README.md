# LittleFounders Backend API

## Estructura del Proyecto

```
backend/
├── main.py                 # Punto de entrada de la aplicación
├── config.py              # Configuración usando Pydantic
├── database.py            # Configuración de base de datos
├── models.py              # Modelos de SQLAlchemy
├── requirements.txt       # Dependencias del proyecto
├── env.example           # Variables de entorno de ejemplo
├── README.md             # Este archivo
│
├── auth/                 # Módulo de autenticación
│   ├── __init__.py
│   └── endpoints.py
│
├── dashboard/            # Módulo de dashboard
│   ├── __init__.py
│   └── endpoints.py
│
├── savings/              # Módulo de ahorros
│   ├── __init__.py
│   └── endpoints.py
│
├── customers/            # Módulo de clientes/amiguitos
│   ├── __init__.py
│   └── endpoints.py
│
├── store/                # Módulo de tienda
│   ├── __init__.py
│   └── endpoints.py
│
├── team/                 # Módulo de equipo
│   ├── __init__.py
│   └── endpoints.py
│
├── lecciones/            # Módulo de lecciones
│   ├── __init__.py
│   └── endpoints.py
│
├── lecciones_v2/         # Módulo de lecciones v2
│   ├── __init__.py
│   └── endpoints.py
│
├── tasks/                # Módulo de tareas
│   ├── __init__.py
│   └── endpoints.py
│
├── parent_tasks/         # Módulo de gestión de tareas para padres
│   ├── __init__.py
│   └── endpoints.py
│
├── investment_games/     # Módulo de juegos de inversión
│   ├── __init__.py
│   └── endpoints.py
│
└── growth/               # Módulo de banca digital
    ├── __init__.py
    └── endpoints.py
```

## Configuración

1. En `.env` configura las variables de entorno
2. Instala las dependencias: `pip install -r ../requirements.txt`
   *(Nota: Si vas a generar lecciones con IA localmente, necesitarás instalar manualmente `google-generativeai`)*
3. Ejecuta la aplicación: `uvicorn main:app --reload`

## Módulos

Cada módulo corresponde a una sección del sidebar del frontend:

- **auth**: Autenticación (registro, login, logout)
- **dashboard**: Página principal y estadísticas
- **savings**: Gestión de ahorros
- **store**: Tienda virtual
- **lecciones**: Sistema de lecciones
- **lecciones_v2**: Sistema de lecciones v2
- **tasks**: Gestión de tareas
- **parent_tasks**: Gestión de tareas para padres
- **investment_games**: Juegos de inversión
- **growth**: Banca digital

## Tecnologías

- **FastAPI**: Framework web moderno y rápido
- **SQLAlchemy**: ORM para Python
- **PostgreSQL**: Base de datos
- **Pydantic**: Validación de datos
- **Uvicorn**: Servidor ASGI
