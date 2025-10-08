# Guía de Deployment en AWS para Little Founders

Este documento describe cómo desplegar la aplicación Little Founders en AWS usando diferentes servicios.

## 📋 Tabla de Contenidos

1. [Pre-requisitos](#pre-requisitos)
2. [Opción 1: Deployment con AWS Elastic Beanstalk](#opción-1-aws-elastic-beanstalk)
3. [Opción 2: Deployment con AWS ECS (Docker)](#opción-2-aws-ecs-docker)
4. [Opción 3: Deployment con EC2 Manual](#opción-3-ec2-manual)
5. [Opción 4: Deployment con AWS CodePipeline](#opción-4-aws-codepipeline)
6. [Configuración de Base de Datos](#configuración-de-base-de-datos)
7. [Variables de Entorno](#variables-de-entorno)
8. [Monitoreo y Logs](#monitoreo-y-logs)

## 🔧 Pre-requisitos

- Cuenta de AWS activa
- AWS CLI instalado y configurado
- Docker instalado (para opciones con contenedores)
- Node.js 18+ y npm
- Python 3.11+
- Git

### Instalar y Configurar AWS CLI

```bash
# Instalar AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurar credenciales
aws configure
```

## 🚀 Opción 1: AWS Elastic Beanstalk

Elastic Beanstalk es la forma más sencilla de desplegar aplicaciones web en AWS.

### 1.1 Instalar EB CLI

```bash
pip install awsebcli
```

### 1.2 Inicializar Elastic Beanstalk

```bash
# En el directorio raíz del proyecto
eb init

# Seleccionar:
# - Región: us-east-1 (o tu preferida)
# - Aplicación: littlefounders
# - Platform: Docker
# - SSH: Sí (recomendado)
```

### 1.3 Crear Entorno

```bash
# Crear entorno de producción
eb create littlefounders-prod --database

# Configurar tipo de instancia
eb scale 1 --type t3.medium
```

### 1.4 Configurar Variables de Entorno

```bash
eb setenv \
  DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  SECRET_KEY="your-secret-key" \
  ALGORITHM="HS256" \
  ACCESS_TOKEN_EXPIRE_MINUTES="30"
```

### 1.5 Desplegar

```bash
eb deploy
```

### 1.6 Ver la aplicación

```bash
eb open
```

## 🐳 Opción 2: AWS ECS (Docker)

Para mayor control y escalabilidad, usa Amazon ECS con Fargate.

### 2.1 Construir y Subir Imágenes Docker

```bash
# Iniciar sesión en ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com

# Crear repositorios
aws ecr create-repository --repository-name littlefounders-frontend
aws ecr create-repository --repository-name littlefounders-backend

# Construir y subir frontend
docker build -t littlefounders-frontend -f Dockerfile.frontend .
docker tag littlefounders-frontend:latest [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/littlefounders-frontend:latest
docker push [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/littlefounders-frontend:latest

# Construir y subir backend
docker build -t littlefounders-backend -f Dockerfile.backend .
docker tag littlefounders-backend:latest [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/littlefounders-backend:latest
docker push [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/littlefounders-backend:latest
```

### 2.2 Crear Cluster ECS

```bash
aws ecs create-cluster --cluster-name littlefounders-cluster
```

### 2.3 Crear Task Definition

Crea un archivo `task-definition.json`:

```json
{
  "family": "littlefounders",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "[ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/littlefounders-backend:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://user:pass@host:5432/dbname"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/littlefounders",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "backend"
        }
      }
    },
    {
      "name": "frontend",
      "image": "[ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/littlefounders-frontend:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/littlefounders",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "frontend"
        }
      }
    }
  ]
}
```

Registrar la definición:

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 2.4 Crear Servicio ECS

```bash
aws ecs create-service \
  --cluster littlefounders-cluster \
  --service-name littlefounders-service \
  --task-definition littlefounders \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

## 💻 Opción 3: EC2 Manual

### 3.1 Lanzar Instancia EC2

```bash
# Crear instancia Ubuntu 22.04 LTS
aws ec2 run-instances \
  --image-id ami-xxxxxxxxx \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --subnet-id subnet-xxxxxxxxx
```

### 3.2 Conectar a la Instancia

```bash
ssh -i your-key.pem ubuntu@ec2-xx-xx-xx-xx.compute-1.amazonaws.com
```

### 3.3 Instalar Dependencias

```bash
# Actualizar sistema
sudo apt-get update
sudo apt-get upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar Python
sudo apt-get install -y python3 python3-pip python3-venv

# Instalar Nginx
sudo apt-get install -y nginx

# Instalar PostgreSQL (o usar RDS)
sudo apt-get install -y postgresql postgresql-contrib
```

### 3.4 Clonar Repositorio

```bash
cd /var/www
sudo git clone https://github.com/tu-usuario/littlefounders-ai.git
cd littlefounders-ai
```

### 3.5 Configurar Backend

```bash
# Instalar dependencias
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Crear archivo .env
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@localhost:5432/littlefounders
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
EOF

# Crear tablas de base de datos
python create_tables.py
```

### 3.6 Configurar Frontend

```bash
cd ..
npm install
npm run build
```

### 3.7 Configurar Nginx

```bash
sudo cp docker/nginx.conf /etc/nginx/sites-available/littlefounders
sudo ln -s /etc/nginx/sites-available/littlefounders /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 3.8 Configurar Systemd para Backend

```bash
sudo cat > /etc/systemd/system/littlefounders-backend.service << EOF
[Unit]
Description=Little Founders Backend API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/littlefounders-ai/backend
Environment="PATH=/var/www/littlefounders-ai/backend/venv/bin"
ExecStart=/var/www/littlefounders-ai/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable littlefounders-backend
sudo systemctl start littlefounders-backend
```

## 🔄 Opción 4: AWS CodePipeline

Para CI/CD automatizado con el archivo `buildspec.yml` ya creado.

### 4.1 Crear Repositorio en CodeCommit

```bash
aws codecommit create-repository --repository-name littlefounders
```

### 4.2 Configurar CodeBuild

```bash
# Crear proyecto de build
aws codebuild create-project \
  --name littlefounders-build \
  --source type=CODECOMMIT,location=https://git-codecommit.us-east-1.amazonaws.com/v1/repos/littlefounders \
  --artifacts type=S3,location=littlefounders-artifacts \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/standard:5.0,computeType=BUILD_GENERAL1_MEDIUM \
  --service-role arn:aws:iam::ACCOUNT_ID:role/CodeBuildServiceRole
```

### 4.3 Crear Pipeline

1. Ve a AWS CodePipeline en la consola
2. Clic en "Create pipeline"
3. Nombre: `littlefounders-pipeline`
4. Source: CodeCommit / GitHub
5. Build: CodeBuild (selecciona el proyecto creado)
6. Deploy: Elastic Beanstalk / ECS / CodeDeploy

### 4.4 Configurar Webhooks (para GitHub)

```bash
aws codepipeline put-webhook \
  --cli-input-json file://webhook.json \
  --region us-east-1
```

## 🗄️ Configuración de Base de Datos

### Opción A: Amazon RDS (Recomendado para Producción)

```bash
# Crear instancia RDS PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier littlefounders-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-name littlefounders
```

### Opción B: PostgreSQL en EC2

Ya cubierto en la Opción 3.

## 🔐 Variables de Entorno

Crea un archivo `.env` basado en `env.example`:

```bash
# Backend
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=tu-llave-secreta-super-segura-cambiar-en-produccion
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend (si es necesario)
VITE_API_URL=https://api.littlefounders.com
```

### Usar AWS Secrets Manager

```bash
# Crear secreto
aws secretsmanager create-secret \
  --name littlefounders/database \
  --secret-string '{"username":"admin","password":"YourSecurePassword123!","host":"xxx.rds.amazonaws.com","port":"5432","dbname":"littlefounders"}'

# Obtener secreto en la aplicación
aws secretsmanager get-secret-value --secret-id littlefounders/database
```

## 📊 Monitoreo y Logs

### CloudWatch Logs

```bash
# Crear grupo de logs
aws logs create-log-group --log-group-name /aws/littlefounders

# Ver logs en tiempo real
aws logs tail /aws/littlefounders --follow
```

### CloudWatch Metrics

Configura alarmas para:
- CPU utilization > 80%
- Memory utilization > 80%
- Request count
- Error rate
- Database connections

### Ejemplo de Alarma

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name littlefounders-high-cpu \
  --alarm-description "Alarma cuando CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## 🔒 Seguridad

### SSL/TLS con AWS Certificate Manager

```bash
# Solicitar certificado
aws acm request-certificate \
  --domain-name littlefounders.com \
  --subject-alternative-names www.littlefounders.com \
  --validation-method DNS
```

### Security Groups

```bash
# Crear security group
aws ec2 create-security-group \
  --group-name littlefounders-sg \
  --description "Security group for Little Founders"

# Permitir HTTP
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Permitir HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Permitir SSH (solo tu IP)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 22 \
  --cidr YOUR_IP/32
```

## 🔄 Actualización y Rollback

### Actualizar aplicación

```bash
# Con Elastic Beanstalk
eb deploy

# Con ECS
aws ecs update-service --cluster littlefounders-cluster --service littlefounders-service --force-new-deployment

# Con EC2
ssh ubuntu@your-instance
cd /var/www/littlefounders-ai
git pull
npm run build
sudo systemctl restart littlefounders-backend
```

### Rollback

```bash
# Con Elastic Beanstalk
eb deploy --version previous-version

# Con ECS
aws ecs update-service --cluster littlefounders-cluster --service littlefounders-service --task-definition littlefounders:PREVIOUS_REVISION
```

## 📝 Comandos Útiles

```bash
# Ver estado de la aplicación
systemctl status littlefounders-backend
systemctl status nginx

# Ver logs
journalctl -u littlefounders-backend -f
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Reiniciar servicios
sudo systemctl restart littlefounders-backend
sudo systemctl restart nginx

# Verificar puertos en uso
sudo netstat -tulpn | grep LISTEN
```

## 🎯 Checklist de Deployment

- [ ] Configurar variables de entorno
- [ ] Configurar base de datos (RDS o EC2)
- [ ] Construir y desplegar frontend
- [ ] Configurar y desplegar backend
- [ ] Configurar Nginx como reverse proxy
- [ ] Configurar SSL/TLS
- [ ] Configurar DNS
- [ ] Configurar monitoreo y alarmas
- [ ] Configurar backups de base de datos
- [ ] Probar la aplicación
- [ ] Configurar CI/CD

## 🆘 Troubleshooting

### Error: No se puede conectar a la base de datos

```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar conexión
psql -h localhost -U littlefounders -d littlefounders_db
```

### Error: Backend no responde

```bash
# Ver logs del backend
journalctl -u littlefounders-backend -n 100

# Verificar que el puerto 8000 está en uso
sudo netstat -tulpn | grep 8000
```

### Error: Frontend no carga

```bash
# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx

# Ver logs de Nginx
tail -f /var/log/nginx/error.log
```

## 📚 Recursos Adicionales

- [AWS Elastic Beanstalk Documentation](https://docs.aws.amazon.com/elasticbeanstalk/)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Vite Production Build](https://vitejs.dev/guide/build.html)

## 🤝 Soporte

Para ayuda adicional:
- Documentación del proyecto: [README.md](./README.md)
- Issues en GitHub
- Contacto del equipo de desarrollo

