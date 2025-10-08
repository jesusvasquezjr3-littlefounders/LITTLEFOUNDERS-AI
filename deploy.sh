#!/bin/bash

# Script de deployment para Little Founders en AWS
# Uso: ./deploy.sh [environment] [method]
# Ejemplo: ./deploy.sh production eb
# Ejemplo: ./deploy.sh production ecs
# Ejemplo: ./deploy.sh production ec2

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar requisitos
check_requirements() {
    log_info "Verificando requisitos..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI no está instalado"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js no está instalado"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm no está instalado"
        exit 1
    fi
    
    log_success "Todos los requisitos están instalados"
}

# Build del frontend
build_frontend() {
    log_info "Construyendo frontend..."
    npm ci
    npm run build
    log_success "Frontend construido exitosamente"
}

# Deployment con Elastic Beanstalk
deploy_eb() {
    log_info "Desplegando con Elastic Beanstalk..."
    
    if ! command -v eb &> /dev/null; then
        log_error "EB CLI no está instalado. Instalar con: pip install awsebcli"
        exit 1
    fi
    
    build_frontend
    
    log_info "Creando paquete de deployment..."
    zip -r deploy.zip . -x '*.git*' 'node_modules/*' 'src/*' '*.zip'
    
    log_info "Desplegando a Elastic Beanstalk..."
    eb deploy
    
    log_success "Deployment completado!"
    eb status
}

# Deployment con ECS
deploy_ecs() {
    log_info "Desplegando con ECS..."
    
    # Obtener ID de cuenta
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    REGION=${AWS_REGION:-us-east-1}
    
    log_info "Account ID: $ACCOUNT_ID"
    log_info "Region: $REGION"
    
    # Login a ECR
    log_info "Iniciando sesión en ECR..."
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
    
    # Build y push frontend
    log_info "Construyendo y subiendo imagen del frontend..."
    docker build -t littlefounders-frontend -f Dockerfile.frontend .
    docker tag littlefounders-frontend:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/littlefounders-frontend:latest
    docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/littlefounders-frontend:latest
    
    # Build y push backend
    log_info "Construyendo y subiendo imagen del backend..."
    docker build -t littlefounders-backend -f Dockerfile.backend .
    docker tag littlefounders-backend:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/littlefounders-backend:latest
    docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/littlefounders-backend:latest
    
    # Actualizar servicio ECS
    log_info "Actualizando servicio ECS..."
    aws ecs update-service \
        --cluster littlefounders-cluster \
        --service littlefounders-service \
        --force-new-deployment \
        --region $REGION
    
    log_success "Deployment completado!"
    log_info "Esperando a que el servicio se estabilice..."
    aws ecs wait services-stable \
        --cluster littlefounders-cluster \
        --services littlefounders-service \
        --region $REGION
    
    log_success "Servicio estabilizado!"
}

# Deployment manual en EC2
deploy_ec2() {
    log_info "Deployment manual en EC2..."
    
    if [ -z "$EC2_HOST" ]; then
        log_error "Variable EC2_HOST no está configurada"
        log_info "Uso: EC2_HOST=ec2-xx-xx-xx-xx.compute-1.amazonaws.com ./deploy.sh production ec2"
        exit 1
    fi
    
    if [ -z "$EC2_KEY" ]; then
        log_error "Variable EC2_KEY no está configurada"
        log_info "Uso: EC2_KEY=~/.ssh/your-key.pem ./deploy.sh production ec2"
        exit 1
    fi
    
    build_frontend
    
    log_info "Creando paquete de deployment..."
    tar -czf deploy.tar.gz \
        backend/ \
        dist/ \
        docker/nginx.conf \
        --exclude='*.pyc' \
        --exclude='__pycache__' \
        --exclude='.env'
    
    log_info "Subiendo archivos a EC2..."
    scp -i $EC2_KEY deploy.tar.gz ubuntu@$EC2_HOST:/tmp/
    
    log_info "Ejecutando deployment en servidor..."
    ssh -i $EC2_KEY ubuntu@$EC2_HOST << 'ENDSSH'
        set -e
        
        # Extraer archivos
        cd /var/www/littlefounders-ai
        sudo tar -xzf /tmp/deploy.tar.gz
        
        # Reiniciar servicios
        sudo systemctl restart littlefounders-backend
        sudo systemctl restart nginx
        
        # Verificar estado
        sudo systemctl status littlefounders-backend --no-pager
        sudo systemctl status nginx --no-pager
        
        echo "Deployment completado!"
ENDSSH
    
    rm deploy.tar.gz
    log_success "Deployment completado en EC2!"
}

# Rollback
rollback() {
    log_warning "Iniciando rollback..."
    
    case $DEPLOY_METHOD in
        eb)
            eb deploy --version $ROLLBACK_VERSION
            ;;
        ecs)
            aws ecs update-service \
                --cluster littlefounders-cluster \
                --service littlefounders-service \
                --task-definition littlefounders:$ROLLBACK_VERSION
            ;;
        *)
            log_error "Rollback no soportado para el método de deployment: $DEPLOY_METHOD"
            exit 1
            ;;
    esac
    
    log_success "Rollback completado!"
}

# Función principal
main() {
    ENVIRONMENT=${1:-production}
    DEPLOY_METHOD=${2:-eb}
    
    log_info "==================================="
    log_info "Little Founders Deployment Script"
    log_info "==================================="
    log_info "Environment: $ENVIRONMENT"
    log_info "Method: $DEPLOY_METHOD"
    log_info "==================================="
    
    check_requirements
    
    case $DEPLOY_METHOD in
        eb)
            deploy_eb
            ;;
        ecs)
            deploy_ecs
            ;;
        ec2)
            deploy_ec2
            ;;
        rollback)
            ROLLBACK_VERSION=$3
            if [ -z "$ROLLBACK_VERSION" ]; then
                log_error "Especifica la versión para rollback"
                exit 1
            fi
            rollback
            ;;
        *)
            log_error "Método de deployment no válido: $DEPLOY_METHOD"
            log_info "Métodos válidos: eb, ecs, ec2, rollback"
            exit 1
            ;;
    esac
    
    log_success "==================================="
    log_success "Deployment finalizado exitosamente!"
    log_success "==================================="
}

# Ejecutar script
main "$@"

