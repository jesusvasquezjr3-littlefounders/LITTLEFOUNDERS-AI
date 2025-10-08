# Guía Completa de Deployment en AWS - LittleFounders

Esta guía te mostrará cómo desplegar tu aplicación en AWS usando diferentes servicios.

## 📋 Tabla de Contenidos

1. [Arquitectura Recomendada](#arquitectura-recomendada)
2. [Prerrequisitos](#prerrequisitos)
3. [Opción 1: Deployment Rápido (Amplify + RDS + EC2)](#opción-1-deployment-rápido)
4. [Opción 2: Deployment Profesional (S3/CloudFront + ECS + RDS)](#opción-2-deployment-profesional)
5. [Opción 3: Deployment Económico (Lightsail)](#opción-3-deployment-económico)
6. [Configuración de Base de Datos](#configuración-de-base-de-datos)
7. [Variables de Entorno](#variables-de-entorno)
8. [SSL/HTTPS](#sslhttps)
9. [CI/CD](#cicd)
10. [Monitoreo y Logs](#monitoreo-y-logs)

---

## 🏗️ Arquitectura Recomendada

```
┌─────────────────┐
│   CloudFront    │ ← CDN para Frontend
└────────┬────────┘
         │
┌────────▼────────┐
│   S3 Bucket     │ ← Frontend (React)
└─────────────────┘

┌─────────────────┐
│   Route 53      │ ← DNS
└────────┬────────┘
         │
┌────────▼────────┐
│  Load Balancer  │ ← Distribuye tráfico
└────────┬────────┘
         │
┌────────▼────────┐
│   ECS/EC2       │ ← Backend (FastAPI)
└────────┬────────┘
         │
┌────────▼────────┐
│   RDS (PgSQL)   │ ← Base de datos
└─────────────────┘
```

---

## 📦 Prerrequisitos

1. **Cuenta de AWS** activa
2. **AWS CLI** instalado y configurado
3. **Docker** instalado (para ECS)
4. **Node.js** y **Python 3.9+**
5. Un dominio (opcional pero recomendado)

### Instalar AWS CLI

```bash
# Windows (con Chocolatey)
choco install awscli

# O descarga desde: https://aws.amazon.com/cli/

# Configurar credenciales
aws configure
# AWS Access Key ID: [tu-key]
# AWS Secret Access Key: [tu-secret]
# Default region name: us-east-1
# Default output format: json
```

---

## 🚀 Opción 1: Deployment Rápido (Amplify + RDS + EC2)

### Ventajas
- ✅ Setup rápido
- ✅ CI/CD automático
- ✅ SSL gratuito
- ✅ Bueno para MVP

### Costos aproximados
- ~$30-60/mes

### Paso 1: Base de Datos (RDS)

1. Ve a **RDS** en AWS Console
2. Click **Create database**
3. Selecciona:
   - **Engine**: PostgreSQL 15
   - **Templates**: Free tier (o Dev/Test)
   - **DB instance identifier**: `littlefounders-db`
   - **Master username**: `postgres`
   - **Master password**: [crea una contraseña segura]
   - **DB instance class**: `db.t3.micro` (o `db.t4g.micro`)
   - **Storage**: 20 GB
   - **Public access**: Yes (temporalmente)
   - **VPC security group**: Create new
     - Name: `littlefounders-db-sg`
4. Click **Create database**
5. Espera ~10 minutos

**Configurar Security Group:**
- Ve a EC2 > Security Groups
- Selecciona `littlefounders-db-sg`
- Edita Inbound rules:
  - Type: PostgreSQL
  - Port: 5432
  - Source: 0.0.0.0/0 (para desarrollo, luego restringe)

**Obtén el endpoint:**
- En RDS Dashboard, click en tu database
- Copia el **Endpoint** (ej: `littlefounders-db.xxxxx.us-east-1.rds.amazonaws.com`)

### Paso 2: Backend en EC2

#### 2.1 Crear instancia EC2

1. Ve a **EC2** en AWS Console
2. Click **Launch Instance**
3. Configuración:
   - **Name**: `littlefounders-backend`
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance type**: `t2.micro` (Free tier) o `t3.small`
   - **Key pair**: Create new o usa existente
   - **Network settings**:
     - Auto-assign Public IP: Enable
     - Security group:
       - SSH (22) desde tu IP
       - HTTP (80) desde Anywhere
       - HTTPS (443) desde Anywhere
       - Custom TCP (8000) desde Anywhere
4. Click **Launch instance**

#### 2.2 Conectar a EC2 y configurar

```bash
# Conectar via SSH
ssh -i "tu-key.pem" ubuntu@[tu-ec2-public-ip]

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Python y dependencias
sudo apt install python3-pip python3-venv nginx -y

# Instalar PostgreSQL client
sudo apt install postgresql-client -y

# Clonar tu repositorio (o subir archivos)
git clone https://github.com/tu-usuario/LITTLEFOUNDERS-AI.git
cd LITTLEFOUNDERS-AI/backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Crear archivo .env
nano .env
```

**Contenido del .env:**
```env
# Database
database_hostname=littlefounders-db.xxxxx.us-east-1.rds.amazonaws.com
database_port=5432
database_password=tu-password-rds
database_name=postgres
database_username=postgres

# Security
secret_key=genera-un-key-seguro-aqui-con-openssl-rand-hex-32
algorithm=HS256
access_token_expire_minutes=30

# Email (configura después)
mail_username=tu-email@gmail.com
mail_password=tu-app-password
mail_from=tu-email@gmail.com
mail_port=587
mail_server=smtp.gmail.com
mail_from_name=LittleFounders
```

#### 2.3 Crear tablas de base de datos

```bash
# Dentro de tu EC2 y directorio backend
python create_tables.py
```

#### 2.4 Configurar Systemd para auto-start

```bash
sudo nano /etc/systemd/system/littlefounders.service
```

**Contenido:**
```ini
[Unit]
Description=LittleFounders FastAPI Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/LITTLEFOUNDERS-AI/backend
Environment="PATH=/home/ubuntu/LITTLEFOUNDERS-AI/backend/venv/bin"
ExecStart=/home/ubuntu/LITTLEFOUNDERS-AI/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar y iniciar servicio
sudo systemctl daemon-reload
sudo systemctl enable littlefounders
sudo systemctl start littlefounders
sudo systemctl status littlefounders

# Ver logs
sudo journalctl -u littlefounders -f
```

#### 2.5 Configurar Nginx como reverse proxy

```bash
sudo nano /etc/nginx/sites-available/littlefounders
```

**Contenido:**
```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # o tu IP pública

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Activar configuración
sudo ln -s /etc/nginx/sites-available/littlefounders /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Tu API ahora está disponible en http://[tu-ip]/
```

### Paso 3: Frontend en Amplify

#### 3.1 Preparar el código

Primero, actualiza la URL del backend en tu frontend:

```bash
# En tu máquina local
cd LITTLEFOUNDERS-AI
```

Crea un archivo de configuración de ambiente:

```bash
# Crear .env.production
echo "VITE_API_URL=http://tu-ec2-ip" > .env.production
```

Actualiza tu código para usar esta variable (si no lo estás haciendo):

```typescript
// src/config/api.ts o similar
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export default API_URL;
```

#### 3.2 Deploy con Amplify

**Opción A: Via Git (Recomendado)**

1. Sube tu código a GitHub (si no está ya)
2. Ve a **AWS Amplify** en AWS Console
3. Click **New app** > **Host web app**
4. Selecciona **GitHub** y autoriza
5. Selecciona tu repositorio y branch (main)
6. Configuración de build:
   - Build command: `npm run build`
   - Base directory: `/` (root)
   - Build output directory: `dist`
7. Variables de entorno:
   - Key: `VITE_API_URL`
   - Value: `http://tu-ec2-ip` (o tu dominio)
8. Click **Save and deploy**

Amplify automáticamente:
- Construirá tu app
- Desplegará en CDN
- Proporcionará un dominio HTTPS (xxxxxx.amplifyapp.com)
- Configurará CI/CD automático

**Opción B: Via CLI**

```bash
# Instalar Amplify CLI
npm install -g @aws-amplify/cli

# Configurar
amplify configure

# En tu proyecto
cd LITTLEFOUNDERS-AI
amplify init

# Deploy
npm run build
amplify publish
```

---

## 🏢 Opción 2: Deployment Profesional (ECS + RDS + S3/CloudFront)

### Ventajas
- ✅ Altamente escalable
- ✅ Auto-scaling
- ✅ Mejor performance
- ✅ Más control

### Costos aproximados
- ~$80-150/mes

### Paso 1: Base de Datos (RDS) - Igual que Opción 1

### Paso 2: Backend con ECS (Docker)

#### 2.1 Crear Dockerfile para Backend

Crea `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/')"

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Crea `backend/.dockerignore`:

```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.env
.venv
*.db
*.sqlite
.git
.gitignore
```

#### 2.2 Crear ECR Repository

```bash
# Crear repositorio ECR
aws ecr create-repository --repository-name littlefounders-backend --region us-east-1

# Login a ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [tu-account-id].dkr.ecr.us-east-1.amazonaws.com
```

#### 2.3 Build y Push Docker Image

```bash
cd backend

# Build
docker build -t littlefounders-backend .

# Tag
docker tag littlefounders-backend:latest [tu-account-id].dkr.ecr.us-east-1.amazonaws.com/littlefounders-backend:latest

# Push
docker push [tu-account-id].dkr.ecr.us-east-1.amazonaws.com/littlefounders-backend:latest
```

#### 2.4 Crear ECS Cluster

1. Ve a **ECS** en AWS Console
2. Click **Create cluster**
3. Configuración:
   - **Cluster name**: `littlefounders-cluster`
   - **Infrastructure**: AWS Fargate (serverless)
4. Click **Create**

#### 2.5 Crear Task Definition

1. En ECS, ve a **Task Definitions**
2. Click **Create new task definition**
3. Configuración:
   - **Task definition family**: `littlefounders-backend-task`
   - **Launch type**: Fargate
   - **Operating system**: Linux
   - **Task role**: Create new o usa ecsTaskExecutionRole
   - **Task memory**: 1GB
   - **Task CPU**: 0.5 vCPU
   
4. Container:
   - **Name**: `littlefounders-backend`
   - **Image URI**: `[tu-account-id].dkr.ecr.us-east-1.amazonaws.com/littlefounders-backend:latest`
   - **Port mappings**: 8000 (TCP)
   - **Environment variables**: (Añade todas las del .env)
     - `database_hostname`: [tu-rds-endpoint]
     - `database_port`: 5432
     - `database_password`: [tu-password]
     - etc.

5. Click **Create**

#### 2.6 Crear Application Load Balancer

1. Ve a **EC2** > **Load Balancers**
2. Click **Create Load Balancer**
3. Selecciona **Application Load Balancer**
4. Configuración:
   - **Name**: `littlefounders-alb`
   - **Scheme**: Internet-facing
   - **IP address type**: IPv4
   - **VPC**: Default o tu VPC
   - **Subnets**: Selecciona al menos 2 AZs
   - **Security groups**: Create new
     - Allow HTTP (80) y HTTPS (443) desde Anywhere
5. **Listeners**:
   - HTTP:80 > Forward to new target group
   - **Target group**:
     - **Name**: `littlefounders-tg`
     - **Target type**: IP
     - **Protocol**: HTTP
     - **Port**: 8000
     - **Health check path**: `/`
6. Click **Create**

#### 2.7 Crear ECS Service

1. Ve a tu cluster `littlefounders-cluster`
2. Click **Create service**
3. Configuración:
   - **Launch type**: Fargate
   - **Task definition**: `littlefounders-backend-task`
   - **Service name**: `littlefounders-backend-service`
   - **Number of tasks**: 2 (para alta disponibilidad)
   - **Load balancer**: Application Load Balancer
     - Selecciona tu ALB
     - Container: littlefounders-backend:8000
     - Target group: littlefounders-tg
4. **Auto Scaling** (opcional):
   - Min tasks: 2
   - Max tasks: 10
   - Target CPU: 70%
5. Click **Create**

### Paso 3: Frontend con S3 + CloudFront

#### 3.1 Build del Frontend

```bash
cd LITTLEFOUNDERS-AI

# Crear .env.production
echo "VITE_API_URL=https://tu-alb-domain.amazonaws.com" > .env.production

# Build
npm run build
```

#### 3.2 Crear S3 Bucket

```bash
# Crear bucket
aws s3 mb s3://littlefounders-frontend --region us-east-1

# Subir archivos
aws s3 sync dist/ s3://littlefounders-frontend --delete

# Configurar bucket para hosting
aws s3 website s3://littlefounders-frontend --index-document index.html --error-document index.html
```

O via Console:
1. Ve a **S3** en AWS Console
2. Click **Create bucket**
3. **Bucket name**: `littlefounders-frontend` (debe ser único globalmente)
4. **Region**: us-east-1
5. **Block Public Access**: Desmarcar (lo protegeremos con CloudFront)
6. Click **Create bucket**
7. Sube los archivos de `dist/`

#### 3.3 Crear CloudFront Distribution

1. Ve a **CloudFront** en AWS Console
2. Click **Create distribution**
3. Configuración:
   - **Origin domain**: Selecciona tu bucket S3
   - **Origin access**: Origin access control (recommended)
   - **Create new OAC**: Yes
   - **Viewer protocol policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - **Cache policy**: CachingOptimized
   - **Origin request policy**: CORS-S3Origin
   - **Default root object**: `index.html`
   - **Price class**: Use only North America and Europe
   - **Alternate domain name (CNAME)**: tu-dominio.com (si tienes)
   - **Custom SSL certificate**: Request o importa certificate
4. Click **Create distribution**

#### 3.4 Configurar Error Pages para SPA

En tu distribución de CloudFront:
1. Ve a **Error pages**
2. Click **Create custom error response**
3. Configuración:
   - **HTTP error code**: 403
   - **Customize error response**: Yes
   - **Response page path**: `/index.html`
   - **HTTP response code**: 200
4. Repetir para error 404

#### 3.5 Actualizar Bucket Policy

CloudFront te dará una policy para copiar al bucket S3.

---

## 💰 Opción 3: Deployment Económico (Lightsail)

### Ventajas
- ✅ Muy económico
- ✅ Setup simple
- ✅ Todo incluido

### Costos aproximados
- ~$15-25/mes

### Paso 1: Crear Lightsail Instance

1. Ve a **Lightsail** en AWS Console
2. Click **Create instance**
3. Configuración:
   - **Instance location**: us-east-1
   - **Platform**: Linux/Unix
   - **Blueprint**: OS Only > Ubuntu 22.04
   - **Plan**: $5/month (512MB RAM) o $10/month (1GB RAM)
   - **Instance name**: `littlefounders-app`
4. Click **Create instance**

### Paso 2: Configurar Lightsail

```bash
# Conectar via SSH desde el navegador o CLI
# Instalar todo lo necesario
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv nginx postgresql postgresql-contrib nodejs npm -y

# Configurar PostgreSQL local
sudo -u postgres createdb littlefounders
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'tu-password';"

# Clonar repositorio
git clone https://github.com/tu-usuario/LITTLEFOUNDERS-AI.git
cd LITTLEFOUNDERS-AI

# Setup Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Crear .env (