# 🚀 Instrucciones para Iniciar el Proyecto Localmente (Full Stack)

Sigue estos pasos para levantar tanto el Backend como el Frontend en tu entorno local.

## 1. Backend (Python/FastAPI)

El backend corre en el puerto `8000`.

1. Abre una terminal y navega a la carpeta `backend`:
   ```bash
   cd backend
   ```

2. (Opcional pero recomendado) Activa tu entorno virtual si tienes uno. Si no, asegúrate de tener las dependencias instaladas:
   ```bash
   pip install -r requirements.txt
   ```

3. Inicia el servidor:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   
   Alternativamente, si tienes python3 configurado específicamente:
   ```bash
   python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## 2. Frontend (React/Vite)

El frontend corre típicamente en el puerto `8080` (o `5173` por defecto, pero configurado para buscar puerto libre).

1. Abre **otra** terminal y navega a la carpeta `frontend`:
   ```bash
   cd frontend
   ```

2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev -- --host
   ```
   o simplemente:
   ```bash
   npm run dev
   ```

## 3. Verificar

- **Frontend**: Abre [http://localhost:8080](http://localhost:8080) (o la URL que te muestre la terminal del frontend).
- **Backend**: La documentación de la API estará disponible en [http://localhost:8000/docs](http://localhost:8000/docs).

---
**Nota**: Para detener los servidores, presiona `Ctrl + C` en las terminales respectivas.
