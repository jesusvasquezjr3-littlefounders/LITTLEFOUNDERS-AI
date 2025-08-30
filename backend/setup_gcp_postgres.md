# Guía de Configuración PostgreSQL en Google Cloud Platform

## Paso 1: Preparar el Entorno GCP

### 1.1 Instalar Google Cloud CLI
```bash
# Instalar gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### 1.2 Configurar Proyecto
```bash
# Establecer proyecto activo
gcloud config set project TU_PROJECT_ID

# Habilitar APIs necesarias
gcloud services enable sqladmin.googleapis.com
gcloud services enable compute.googleapis.com
```

## Paso 2: Crear Instancia PostgreSQL

### 2.1 Crear Instancia
```bash
# Crear instancia de PostgreSQL
gcloud sql instances create littlefounders-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --storage-size=10GB \
    --storage-type=SSD \
    --availability-type=ZONAL \
    --backup-start-time=03:00 \
    --enable-bin-log \
    --storage-auto-increase
```

### 2.2 Configurar Usuario Root
```bash
# Establecer contraseña para el usuario postgres
gcloud sql users set-password postgres \
    --instance=littlefounders-db \
    --password=TU_CONTRASEÑA_SEGURA
```

### 2.3 Crear Usuario de Aplicación
```bash
# Crear usuario específico para la aplicación
gcloud sql users create littlefounders_user \
    --instance=littlefounders-db \
    --password=TU_CONTRASEÑA_APLICACION
```

### 2.4 Crear Base de Datos
```bash
# Crear base de datos
gcloud sql databases create littlefounders_db \
    --instance=littlefounders-db
```

## Paso 3: Configurar Redes y Acceso

### 3.1 Obtener IP de la Instancia
```bash
# Obtener información de la instancia
gcloud sql instances describe littlefounders-db
```

### 3.2 Configurar IP Autorizada (Temporal para desarrollo)
```bash
# Agregar tu IP actual para desarrollo
curl ifconfig.me
gcloud sql instances patch littlefounders-db \
    --authorized-networks=TU_IP_PUBLICA/32
```

### 3.3 Para Producción: Configurar VPC y Private IP
```bash
# Crear VPC connector (recomendado para producción)
gcloud compute networks vpc-access connectors create littlefounders-connector \
    --region=us-central1 \
    --subnet=default \
    --subnet-project=TU_PROJECT_ID \
    --min-instances=2 \
    --max-instances=3 \
    --machine-type=f1-micro
```

## Paso 4: Configurar Variables de Entorno

### 4.1 Crear archivo .env
```bash
cp .env.example .env
```

### 4.2 Configurar .env con datos reales
```env
# IP pública de tu instancia Cloud SQL
DATABASE_URL=postgresql://littlefounders_user:TU_CONTRASEÑA@IP_PUBLICA:5432/littlefounders_db

# Claves de seguridad
SECRET_KEY=tu_clave_secreta_muy_larga_y_compleja_para_jwt
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Configuración de uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

## Paso 5: Ejecutar Migraciones

### 5.1 Verificar Conexión
```bash
# Probar conexión
python -c "
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
url = os.getenv('DATABASE_URL')
print(f'Conectando a: {url}')

try:
    conn = psycopg2.connect(url)
    print('✅ Conexión exitosa!')
    conn.close()
except Exception as e:
    print(f'❌ Error de conexión: {e}')
"
```

### 5.2 Ejecutar Migraciones
```bash
# Ejecutar migraciones
export PATH="/home/ubuntu/.local/bin:$PATH"
alembic upgrade head
```

## Paso 6: Poblar Datos Iniciales

### 6.1 Migrar Usuarios Existentes
```bash
# Ejecutar servidor
python main_v2.py &

# Migrar usuarios desde users.txt
curl -X POST http://localhost:8000/migrate/users

# Detener servidor
killall python
```

### 6.2 Verificar Migración
```bash
# Verificar usuarios migrados
curl http://localhost:8000/users/summary
```

## Paso 7: Configuración de Producción

### 7.1 Cloud Run Deployment
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/littlefounders-api', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/littlefounders-api']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'littlefounders-api'
      - '--image'
      - 'gcr.io/$PROJECT_ID/littlefounders-api'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
```

### 7.2 Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main_v2:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 7.3 Variables de Entorno en Cloud Run
```bash
# Configurar variables de entorno en Cloud Run
gcloud run services update littlefounders-api \
    --region=us-central1 \
    --set-env-vars="DATABASE_URL=postgresql://user:pass@private-ip:5432/db"
```

## Comandos Útiles de Desarrollo

### Conectar a la Base de Datos
```bash
# Conectar usando gcloud
gcloud sql connect littlefounders-db --user=postgres

# Conectar usando psql directo
psql -h IP_PUBLICA -U littlefounders_user -d littlefounders_db
```

### Backup y Restore
```bash
# Crear backup
gcloud sql export sql littlefounders-db gs://tu-bucket/backup.sql \
    --database=littlefounders_db

# Restaurar backup
gcloud sql import sql littlefounders-db gs://tu-bucket/backup.sql \
    --database=littlefounders_db
```

### Monitoreo
```bash
# Ver logs de la instancia
gcloud sql operations list --instance=littlefounders-db

# Métricas de CPU y memoria
gcloud sql instances describe littlefounders-db
```

## Consideraciones de Seguridad

1. **IPs Autorizadas**: Configurar solo IPs necesarias
2. **SSL**: Habilitar conexiones SSL obligatorias
3. **Backup Automático**: Configurar backups diarios
4. **Monitoring**: Configurar alertas de CPU y memoria
5. **Private IP**: Usar IP privada para producción

## Estimación de Costos

- **db-f1-micro**: ~$7-10/mes
- **10GB SSD**: ~$1.70/mes
- **Backup**: ~$0.08/GB/mes
- **Total estimado**: ~$10-15/mes

## Troubleshooting

### Error de Conexión
1. Verificar IP autorizada
2. Verificar credenciales
3. Verificar que la instancia esté corriendo

### Error de Migraciones
1. Verificar que las tablas no existan
2. Ejecutar `alembic downgrade base` y luego `alembic upgrade head`

### Performance Issues
1. Verificar índices en columnas frecuentemente consultadas
2. Considerar upgrade a tier superior
3. Optimizar queries con EXPLAIN