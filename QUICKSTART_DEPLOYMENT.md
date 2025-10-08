# 🚀 Quick Start - Deployment en AWS

Guía rápida para desplegar Little Founders en AWS en menos de 30 minutos.

## 📦 Opción Más Rápida: Elastic Beanstalk

### 1. Pre-requisitos (5 minutos)

```bash
# Instalar AWS CLI (si no lo tienes)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurar credenciales
aws configure
# Ingresa: AWS Access Key ID, Secret Access Key, región (us-east-1), formato (json)

# Instalar EB CLI
pip install awsebcli
```

### 2. Setup de Base de Datos (5 minutos)

```bash
# Crear RDS PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier littlefounders-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password ChangeMe123! \
  --allocated-storage 20 \
  --publicly-accessible

# Esperar a que esté disponible (toma ~5 minutos)
aws rds wait db-instance-available --db-instance-identifier littlefounders-db

# Obtener endpoint
aws rds describe-db-instances \
  --db-instance-identifier littlefounders-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### 3. Inicializar Elastic Beanstalk (5 minutos)

```bash
# En el directorio del proyecto
cd /path/to/LITTLEFOUNDERS-AI

# Inicializar EB
eb init -p docker littlefounders --region us-east-1

# Crear entorno (esto toma ~5-10 minutos)
eb create littlefounders-prod
```

### 4. Configurar Variables de Entorno (2 minutos)

```bash
# Reemplaza con tu endpoint de RDS
eb setenv \
  DATABASE_URL="postgresql://admin:ChangeMe123!@tu-endpoint.rds.amazonaws.com:5432/postgres" \
  SECRET_KEY="tu-clave-secreta-super-segura-cambiar-en-produccion" \
  ALGORITHM="HS256" \
  ACCESS_TOKEN_EXPIRE_MINUTES="30"
```

### 5. Build y Deploy (5 minutos)

```bash
# Build del frontend
npm ci
npm run build

# Deploy
eb deploy

# Abrir en navegador
eb open
```

### 6. Verificar (2 minutos)

```bash
# Ver logs
eb logs

# Ver estado
eb status

# Ver salud de la aplicación
eb health
```

## ✅ ¡Listo! Tu aplicación está en producción

URL de tu aplicación: `http://littlefounders-prod.us-east-1.elasticbeanstalk.com`

---

## 🐳 Opción Alternativa: Docker + ECS (Más control)

### 1. Setup (10 minutos)

```bash
# Obtener Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1

# Crear repositorios ECR
aws ecr create-repository --repository-name littlefounders-frontend
aws ecr create-repository --repository-name littlefounders-backend

# Login a ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
```

### 2. Build y Push (10 minutos)

```bash
# Build y push frontend
docker build -t littlefounders-frontend -f Dockerfile.frontend .
docker tag littlefounders-frontend:latest \
  $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/littlefounders-frontend:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/littlefounders-frontend:latest

# Build y push backend
docker build -t littlefounders-backend -f Dockerfile.backend .
docker tag littlefounders-backend:latest \
  $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/littlefounders-backend:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/littlefounders-backend:latest
```

### 3. Crear Cluster y Servicio (10 minutos)

```bash
# Crear cluster
aws ecs create-cluster --cluster-name littlefounders-cluster

# Registrar task definition (necesitas editar el archivo con tu Account ID)
# Edita task-definition.json con tus imágenes ECR
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Crear servicio (necesitas VPC, subnets, security groups)
aws ecs create-service \
  --cluster littlefounders-cluster \
  --service-name littlefounders-service \
  --task-definition littlefounders \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

---

## 🔧 Usando el Script de Deployment

Usa el script automatizado `deploy.sh`:

```bash
# Dar permisos de ejecución
chmod +x deploy.sh

# Deployment con Elastic Beanstalk
./deploy.sh production eb

# Deployment con ECS
./deploy.sh production ecs

# Deployment manual en EC2
EC2_HOST=ec2-xx-xx-xx-xx.compute-1.amazonaws.com \
EC2_KEY=~/.ssh/your-key.pem \
./deploy.sh production ec2
```

---

## 🔄 Setup de CI/CD (Opcional)

### GitHub Actions

1. **Agregar secrets a GitHub:**
   - Ve a Settings > Secrets and variables > Actions
   - Agrega: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

2. **Push a main:**
   ```bash
   git add .
   git commit -m "Setup deployment"
   git push origin main
   ```

3. **El workflow se ejecutará automáticamente**

### AWS CodePipeline

```bash
# Crear repositorio en CodeCommit
aws codecommit create-repository --repository-name littlefounders

# Agregar remote
git remote add aws https://git-codecommit.us-east-1.amazonaws.com/v1/repos/littlefounders

# Push
git push aws main

# Crear pipeline desde la consola de AWS
# El buildspec.yml ya está configurado
```

---

## 📊 Monitoreo Post-Deployment

```bash
# Ver logs en tiempo real
aws logs tail /aws/elasticbeanstalk/littlefounders-prod/var/log/eb-docker/containers/eb-current-app --follow

# Ver métricas
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElasticBeanstalk \
  --metric-name EnvironmentHealth \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## 🆘 Troubleshooting Rápido

### Error: Cannot connect to database
```bash
# Verificar security group del RDS
# Debe permitir conexiones desde el security group de EB/ECS

aws rds modify-db-instance \
  --db-instance-identifier littlefounders-db \
  --vpc-security-group-ids sg-xxx
```

### Error: 502 Bad Gateway
```bash
# Ver logs del backend
eb logs

# Verificar que las variables de entorno están configuradas
eb printenv
```

### Error: Build failed
```bash
# Ver logs de CodeBuild
aws codebuild batch-get-builds --ids BUILD_ID

# Verificar buildspec.yml
cat buildspec.yml
```

---

## 🔐 Seguridad Básica

```bash
# Configurar HTTPS (certificado SSL)
# 1. Solicitar certificado en ACM
aws acm request-certificate \
  --domain-name littlefounders.com \
  --validation-method DNS

# 2. Configurar en Load Balancer
# Desde la consola de EB:
# Configuration > Load Balancer > Listeners > Add listener (443, HTTPS)
```

---

## 📈 Próximos Pasos

1. **Configurar dominio personalizado**
   - Route 53 o tu proveedor DNS
   - Apuntar a tu aplicación EB/ECS

2. **Configurar CloudFront (CDN)**
   - Mejorar performance
   - Cache de assets estáticos

3. **Configurar Auto-scaling**
   - Manejar tráfico variable
   - Reducir costos

4. **Configurar Backups**
   - Snapshots automáticos de RDS
   - Backup de configuración

5. **Monitoreo avanzado**
   - CloudWatch Dashboards
   - Alertas por email/SMS

---

## 💰 Estimación de Costos (us-east-1)

**Elastic Beanstalk (básico):**
- EC2 t3.small: ~$15/mes
- RDS db.t3.micro: ~$15/mes
- Load Balancer: ~$20/mes
- **Total: ~$50/mes**

**ECS Fargate:**
- 0.25 vCPU + 0.5 GB: ~$13/mes
- RDS db.t3.micro: ~$15/mes
- **Total: ~$28/mes**

*Precios aproximados, verificar en AWS Calculator*

---

## 📚 Más Información

- [Guía Completa de Deployment](./DEPLOYMENT_AWS.md)
- [Checklist de Deployment](./DEPLOYMENT_CHECKLIST.md)
- [README Principal](./README.md)

---

**¿Necesitas ayuda?** Consulta los logs primero:
```bash
# Elastic Beanstalk
eb logs

# ECS
aws logs tail /ecs/littlefounders --follow

# EC2
ssh -i key.pem ubuntu@ec2-xxx
sudo journalctl -u littlefounders-backend -f
```

