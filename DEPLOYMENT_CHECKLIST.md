# 📋 Checklist de Deployment para AWS

Este documento proporciona una lista de verificación paso a paso para desplegar Little Founders en AWS.

## ✅ Pre-Deployment

### 1. Configuración Local
- [ ] Node.js 18+ instalado
- [ ] Python 3.11+ instalado
- [ ] AWS CLI instalado y configurado
- [ ] Docker instalado (si usas contenedores)
- [ ] Git configurado con repositorio

### 2. Archivos de Configuración
- [ ] `buildspec.yml` presente en el repositorio
- [ ] `Dockerfile`, `Dockerfile.frontend`, `Dockerfile.backend` configurados
- [ ] `docker-compose.yml` configurado
- [ ] Archivos de configuración Nginx en `docker/`
- [ ] `.env.example` actualizado con todas las variables necesarias

### 3. Cuenta AWS
- [ ] Cuenta AWS activa
- [ ] Credenciales IAM configuradas
- [ ] Permisos necesarios:
  - [ ] EC2 (si usas instancias)
  - [ ] ECS (si usas contenedores)
  - [ ] RDS (para base de datos)
  - [ ] S3 (para almacenamiento)
  - [ ] CloudWatch (para logs)
  - [ ] ECR (para imágenes Docker)
  - [ ] CodeBuild/CodePipeline (para CI/CD)

## 🗄️ Base de Datos

### Amazon RDS
- [ ] Crear instancia RDS PostgreSQL
- [ ] Configurar security group para permitir conexiones
- [ ] Crear base de datos inicial
- [ ] Guardar credenciales en Secrets Manager
- [ ] Configurar backups automáticos
- [ ] Probar conexión desde local

**Comando:**
```bash
aws rds create-db-instance \
  --db-instance-identifier littlefounders-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password [PASSWORD] \
  --allocated-storage 20
```

## 🔐 Seguridad y Secrets

### AWS Secrets Manager
- [ ] Crear secreto para database credentials
- [ ] Crear secreto para JWT secret key
- [ ] Configurar permisos de acceso
- [ ] Documentar ARNs de secrets

**Comando:**
```bash
aws secretsmanager create-secret \
  --name littlefounders/database \
  --secret-string '{"username":"admin","password":"[PASSWORD]","host":"xxx.rds.amazonaws.com","port":"5432","dbname":"littlefounders"}'
```

### Security Groups
- [ ] Crear security group para aplicación
- [ ] Permitir tráfico HTTP (80)
- [ ] Permitir tráfico HTTPS (443)
- [ ] Permitir SSH desde IP específica (22)
- [ ] Configurar reglas de salida

### SSL/TLS
- [ ] Solicitar certificado en ACM
- [ ] Validar certificado (DNS o email)
- [ ] Configurar en Load Balancer o CloudFront

## 🚀 Opción 1: Elastic Beanstalk

### Setup Inicial
- [ ] Instalar EB CLI: `pip install awsebcli`
- [ ] Inicializar aplicación: `eb init`
- [ ] Crear entorno: `eb create littlefounders-prod`
- [ ] Configurar tipo de instancia: `eb scale 1 --type t3.medium`

### Configuración
- [ ] Configurar variables de entorno
- [ ] Configurar health checks
- [ ] Configurar auto-scaling (opcional)
- [ ] Configurar load balancer

### Deployment
- [ ] Build local: `npm run build`
- [ ] Deploy: `eb deploy`
- [ ] Verificar: `eb open`
- [ ] Revisar logs: `eb logs`

**Variables de Entorno:**
```bash
eb setenv \
  DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  SECRET_KEY="your-secret-key" \
  ALGORITHM="HS256" \
  ACCESS_TOKEN_EXPIRE_MINUTES="30"
```

## 🐳 Opción 2: ECS (Elastic Container Service)

### Setup de ECR
- [ ] Crear repositorio para frontend
- [ ] Crear repositorio para backend
- [ ] Configurar lifecycle policies

**Comandos:**
```bash
aws ecr create-repository --repository-name littlefounders-frontend
aws ecr create-repository --repository-name littlefounders-backend
```

### Build y Push de Imágenes
- [ ] Build imagen frontend: `docker build -f Dockerfile.frontend`
- [ ] Build imagen backend: `docker build -f Dockerfile.backend`
- [ ] Tag imágenes
- [ ] Push a ECR
- [ ] Verificar imágenes en ECR

### Setup de ECS
- [ ] Crear cluster ECS
- [ ] Crear task definition
- [ ] Configurar service
- [ ] Configurar load balancer
- [ ] Configurar auto-scaling

**Task Definition:**
- [ ] CPU: 512
- [ ] Memory: 1024
- [ ] Network mode: awsvpc
- [ ] Compatibility: FARGATE

### Deployment
- [ ] Registrar task definition
- [ ] Crear service
- [ ] Verificar deployment
- [ ] Configurar CloudWatch logs

## 💻 Opción 3: EC2 Manual

### Lanzar Instancia
- [ ] Crear instancia EC2 (Ubuntu 22.04)
- [ ] Tipo de instancia: t3.medium o superior
- [ ] Configurar security group
- [ ] Asignar key pair
- [ ] Elastic IP (opcional, recomendado)

### Configuración del Servidor
- [ ] Conectar via SSH
- [ ] Actualizar sistema: `sudo apt update && sudo apt upgrade`
- [ ] Instalar Node.js 18
- [ ] Instalar Python 3.11
- [ ] Instalar Nginx
- [ ] Instalar PostgreSQL (o usar RDS)

### Deployment de Aplicación
- [ ] Clonar repositorio
- [ ] Instalar dependencias frontend: `npm ci`
- [ ] Build frontend: `npm run build`
- [ ] Instalar dependencias backend: `pip install -r requirements.txt`
- [ ] Configurar archivo .env
- [ ] Crear tablas de DB: `python create_tables.py`

### Configurar Servicios
- [ ] Copiar configuración Nginx
- [ ] Habilitar sitio Nginx
- [ ] Crear servicio systemd para backend
- [ ] Iniciar servicios
- [ ] Verificar estado

**Servicio Systemd:**
```bash
sudo nano /etc/systemd/system/littlefounders-backend.service
sudo systemctl daemon-reload
sudo systemctl enable littlefounders-backend
sudo systemctl start littlefounders-backend
```

## 🔄 Opción 4: CI/CD con CodePipeline

### Setup de Repositorio
- [ ] Crear repositorio en CodeCommit o conectar GitHub
- [ ] Push código al repositorio
- [ ] Verificar buildspec.yml

### CodeBuild
- [ ] Crear proyecto CodeBuild
- [ ] Configurar source (CodeCommit/GitHub)
- [ ] Configurar environment (Linux, Docker)
- [ ] Configurar artifacts (S3)
- [ ] Configurar role con permisos necesarios
- [ ] Probar build manual

### CodePipeline
- [ ] Crear pipeline
- [ ] Configurar source stage
- [ ] Configurar build stage
- [ ] Configurar deploy stage
- [ ] Configurar notificaciones (SNS)
- [ ] Probar pipeline

### GitHub Actions (Alternativa)
- [ ] Configurar secrets en GitHub
- [ ] Verificar workflow files en `.github/workflows/`
- [ ] Push a main/production para trigger
- [ ] Monitorear ejecución

**Secrets de GitHub:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

## 📊 Post-Deployment

### Monitoreo
- [ ] Configurar CloudWatch dashboards
- [ ] Crear alarmas para CPU > 80%
- [ ] Crear alarmas para Memory > 80%
- [ ] Crear alarmas para errores 5xx
- [ ] Configurar SNS para notificaciones
- [ ] Configurar log retention

### Logs
- [ ] Verificar logs en CloudWatch
- [ ] Configurar filtros de logs
- [ ] Configurar alertas basadas en logs

### Backups
- [ ] Configurar snapshots de RDS
- [ ] Configurar backup de S3 (si aplica)
- [ ] Documentar procedimiento de restore
- [ ] Probar restore de backup

### DNS y Dominio
- [ ] Configurar Route 53 o DNS provider
- [ ] Crear registros A/CNAME
- [ ] Verificar propagación DNS
- [ ] Configurar health checks

### Testing
- [ ] Probar registro de usuario
- [ ] Probar login
- [ ] Probar funcionalidades principales
- [ ] Probar desde diferentes dispositivos
- [ ] Verificar performance
- [ ] Probar manejo de errores

### Documentación
- [ ] Documentar URLs de producción
- [ ] Documentar credenciales (en lugar seguro)
- [ ] Documentar procedimientos de rollback
- [ ] Documentar contactos de emergencia
- [ ] Actualizar README con info de deployment

## 🔍 Verificación Final

### Funcionalidad
- [ ] Frontend carga correctamente
- [ ] Backend responde en /api
- [ ] Database conecta correctamente
- [ ] Autenticación funciona
- [ ] Todas las rutas funcionan
- [ ] Assets estáticos cargan

### Performance
- [ ] Tiempo de carga < 3 segundos
- [ ] API response time < 500ms
- [ ] Sin errores en consola del browser
- [ ] Sin errores 5xx en logs

### Seguridad
- [ ] HTTPS configurado y funcionando
- [ ] Certificado SSL válido
- [ ] Headers de seguridad configurados
- [ ] CORS configurado correctamente
- [ ] Secrets no expuestos
- [ ] Database no accesible públicamente

### Monitoreo
- [ ] CloudWatch logs funcionando
- [ ] Métricas reportándose correctamente
- [ ] Alarmas configuradas y funcionando
- [ ] Notificaciones llegando correctamente

## 🆘 Troubleshooting

### Si el deployment falla:
1. [ ] Revisar logs de CodeBuild
2. [ ] Verificar buildspec.yml
3. [ ] Verificar permisos IAM
4. [ ] Revisar security groups
5. [ ] Verificar variables de entorno

### Si la aplicación no funciona:
1. [ ] Revisar CloudWatch logs
2. [ ] Verificar conexión a database
3. [ ] Verificar configuración de Nginx
4. [ ] Revisar variables de entorno
5. [ ] Verificar health checks

### Si hay problemas de performance:
1. [ ] Revisar métricas de CloudWatch
2. [ ] Verificar query performance en DB
3. [ ] Considerar auto-scaling
4. [ ] Configurar CloudFront CDN
5. [ ] Optimizar assets estáticos

## 📝 Comandos Útiles

```bash
# Ver logs en tiempo real
aws logs tail /aws/littlefounders --follow

# Ver estado de servicio ECS
aws ecs describe-services --cluster littlefounders-cluster --services littlefounders-service

# Ver instancias EC2
aws ec2 describe-instances --filters "Name=tag:Name,Values=littlefounders"

# Ver métricas
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization --start-time 2024-01-01T00:00:00Z --end-time 2024-01-02T00:00:00Z --period 3600 --statistics Average

# Rollback EB
eb deploy --version previous-version

# Rollback ECS
aws ecs update-service --cluster littlefounders-cluster --service littlefounders-service --task-definition littlefounders:PREVIOUS_REVISION
```

## 🎯 Resumen

Una vez completados todos los checkpoints, tu aplicación debería estar:
- ✅ Desplegada y funcionando en AWS
- ✅ Accesible vía HTTPS
- ✅ Con base de datos configurada y segura
- ✅ Con monitoreo y alarmas activas
- ✅ Con backups automáticos
- ✅ Con CI/CD funcionando
- ✅ Lista para producción

## 📞 Contacto y Soporte

Si encuentras problemas:
1. Consulta la [Guía de Deployment](./DEPLOYMENT_AWS.md)
2. Revisa los logs en CloudWatch
3. Contacta al equipo de DevOps
4. Abre un issue en GitHub

---

**Última actualización:** Octubre 2024

