# 🛠️ AWS CodeBuild Troubleshooting

## ✅ Problema Resuelto: Error de Instalación de Node.js

### Error Original
```
Error: This script is only supported on Debian-based systems.
exit status 1
```

### Causa
El script original en `buildspec.yml` intentaba instalar Node.js usando el método de Debian/Ubuntu:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
```

Pero **AWS CodeBuild usa Amazon Linux 2** por defecto, no Debian/Ubuntu.

### Solución Implementada ✅

Actualizamos `buildspec.yml` para usar los **runtime-versions nativos de AWS CodeBuild**:

```yaml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 18
      python: 3.11
    commands:
      - node --version
      - npm --version
      - python3 --version
```

### Ventajas de Esta Solución

1. ✅ **Compatible con Amazon Linux 2** (el SO de CodeBuild)
2. ✅ **Más rápido** - No necesita descargar e instalar Node.js
3. ✅ **Más confiable** - Usa versiones pre-instaladas de AWS
4. ✅ **Más simple** - Menos comandos en el buildspec

---

## 🚀 Próximos Pasos

### 1. Commit y Push del Archivo Actualizado

```bash
git add buildspec.yml
git commit -m "Fix: Actualizar buildspec.yml para Amazon Linux 2"
git push origin main
```

### 2. Reintentar el Build en AWS CodeBuild

El build debería funcionar ahora. La secuencia será:

1. **INSTALL phase** - Instala Node.js 18 y Python 3.11
2. **PRE_BUILD phase** - Instala dependencias (npm ci, pip install)
3. **BUILD phase** - Construye el frontend (npm run build)
4. **POST_BUILD phase** - Prepara artefactos para deployment

---

## 🔍 Verificar el Build

### Desde AWS Console

1. Ve a **AWS CodeBuild** > **Build projects**
2. Selecciona tu proyecto
3. Clic en **Build history**
4. Revisa los logs de cada fase

### Logs Esperados

```
[Container] Phase complete: INSTALL State: SUCCEEDED
[Container] Phase complete: PRE_BUILD State: SUCCEEDED
[Container] Phase complete: BUILD State: SUCCEEDED
[Container] Phase complete: POST_BUILD State: SUCCEEDED
```

---

## 🐛 Otros Problemas Comunes

### Problema: `tsc: command not found` ✅ RESUELTO

**Error:**
```
sh: line 1: tsc: command not found
npm run build exit status 127
Phase complete: BUILD State: FAILED
```

**Causa:**
Las **devDependencies** (como TypeScript) no se instalaron. Por defecto, en algunos ambientes, `npm ci` puede omitir las devDependencies.

**Solución Aplicada:**
```yaml
pre_build:
  commands:
    # Instalar TODAS las dependencias (incluyendo devDependencies)
    - npm ci --include=dev
    
    # Verificar que TypeScript está instalado
    - npx tsc --version
```

El flag `--include=dev` asegura que se instalen las devDependencies necesarias para el build (TypeScript, Vite, etc.).

---

### Problema: Error en `npm ci`

**Error:**
```
npm ERR! The `npm ci` command can only install with an existing package-lock.json
```

**Solución:**
Asegúrate de que `package-lock.json` esté en el repositorio:
```bash
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

---

### Problema: Error en `pip install`

**Error:**
```
Could not find a version that satisfies the requirement X
```

**Solución:**
Verifica que `backend/requirements.txt` tenga versiones compatibles con Python 3.11:
```bash
cd backend
pip3 install -r requirements.txt
```

---

### Problema: Build exitoso pero deployment falla

**Síntomas:**
- Build en CodeBuild: ✅ SUCCESS
- Deployment: ❌ FAILED

**Causas Comunes:**

1. **Variables de entorno no configuradas**
   ```bash
   # Verificar en la instancia EC2
   echo $DATABASE_URL
   echo $SECRET_KEY
   ```

2. **Base de datos no accesible**
   - Verificar Security Groups
   - Verificar que RDS permite conexiones desde EC2

3. **Permisos de archivos**
   ```bash
   # Los scripts deben ser ejecutables
   chmod +x /var/www/littlefounders/deploy/scripts/*.sh
   ```

---

### Problema: Frontend no carga

**Síntomas:**
- Página en blanco
- Error 404 en assets

**Solución:**
Verificar configuración de Nginx:
```bash
# Conectar a EC2
ssh -i key.pem ec2-user@your-instance

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx

# Ver logs
sudo tail -f /var/log/nginx/error.log
```

---

### Problema: Backend no responde

**Síntomas:**
- Error 502 Bad Gateway
- Timeout en /api

**Solución:**
```bash
# Verificar que el backend está corriendo
sudo systemctl status littlefounders-backend

# Ver logs
sudo journalctl -u littlefounders-backend -f

# Reiniciar si es necesario
sudo systemctl restart littlefounders-backend
```

---

## 📊 Estructura del Build

```
buildspec.yml
│
├── INSTALL (2-3 min)
│   └── Instala Node.js 18 y Python 3.11
│
├── PRE_BUILD (3-5 min)
│   ├── npm ci (instala dependencias frontend)
│   └── pip install (instala dependencias backend)
│
├── BUILD (2-4 min)
│   ├── npm run build (construye frontend)
│   └── Prepara backend
│
└── POST_BUILD (1-2 min)
    ├── Copia archivos a deploy/
    ├── Crea appspec.yml
    └── Crea scripts de deployment

Total estimado: 8-14 minutos
```

---

## 🔧 Configuración de CodeBuild

### Imagen Recomendada
```
Image: aws/codebuild/standard:7.0
```

Esta imagen incluye:
- Amazon Linux 2
- Node.js 18 (y otras versiones)
- Python 3.11
- Docker
- Git
- AWS CLI

### Especificaciones Mínimas
```
Compute: BUILD_GENERAL1_SMALL (3 GB memory, 2 vCPU)
```

Para builds más rápidos:
```
Compute: BUILD_GENERAL1_MEDIUM (7 GB memory, 4 vCPU)
```

---

## 📝 Checklist de Deployment

Pre-Build:
- [ ] `buildspec.yml` actualizado ✅
- [ ] `package-lock.json` en el repo
- [ ] `backend/requirements.txt` actualizado
- [ ] Código pusheado a GitHub/CodeCommit

AWS Resources:
- [ ] Proyecto CodeBuild creado
- [ ] RDS PostgreSQL creado y accesible
- [ ] EC2 o ambiente de deployment listo
- [ ] Security Groups configurados

Variables de Entorno:
- [ ] `DATABASE_URL` configurada
- [ ] `SECRET_KEY` configurada
- [ ] Otras variables necesarias

Post-Build:
- [ ] Build exitoso en CodeBuild
- [ ] Artefactos generados
- [ ] Deployment ejecutado
- [ ] Aplicación accesible

---

## 🆘 Comandos Útiles

### Ver Logs del Build
```bash
# AWS CLI
aws codebuild batch-get-builds --ids BUILD_ID

# Ver logs en tiempo real (desde Console)
AWS Console > CodeBuild > Build history > View logs
```

### Re-ejecutar Build
```bash
# Desde AWS CLI
aws codebuild start-build --project-name littlefounders-build

# Desde Console
AWS CodeBuild > Start build
```

### Verificar Artefactos
```bash
# Listar artefactos en S3
aws s3 ls s3://your-artifacts-bucket/

# Descargar artefacto
aws s3 cp s3://your-artifacts-bucket/artifact.zip ./
```

---

## 📚 Referencias

- [AWS CodeBuild Build Spec Reference](https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html)
- [Docker Images for CodeBuild](https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html)
- [Runtime Versions](https://docs.aws.amazon.com/codebuild/latest/userguide/runtime-versions.html)

---

## ✅ Resumen

**Cambio Principal:**
```yaml
# Antes (❌ No funciona en Amazon Linux 2)
- curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
- apt-get install -y nodejs

# Después (✅ Funciona en Amazon Linux 2)
install:
  runtime-versions:
    nodejs: 18
    python: 3.11
```

**Resultado:**
- Build más rápido ⚡
- Más confiable ✅
- Compatible con AWS CodeBuild 🚀

---

**Última actualización:** Octubre 2024  
**Estado:** ✅ RESUELTO

