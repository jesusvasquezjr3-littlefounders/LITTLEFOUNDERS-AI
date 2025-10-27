# Guía de Deployment en AWS S3

## Problema Actual
Error 403 (Forbidden) al intentar cargar archivos JS, CSS y recursos del sitio web.

## Causa
El bucket S3 tiene bloqueado el acceso público.

## Solución: Configurar S3 para Hosting Estático

### Paso 1: Desbloquear Acceso Público

1. Ve a **AWS Console → S3**
2. Selecciona tu bucket
3. Ve a la pestaña **"Permissions"** (Permisos)
4. En **"Block public access (bucket settings)"**, haz clic en **"Edit"**
5. **Desmarca todas las casillas:**
   - ❌ Block all public access
   - ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Block public and cross-account access to buckets and objects through any public bucket or access point policies
6. Clic en **"Save changes"**
7. Escribe **"confirm"** cuando te lo pida

### Paso 2: Agregar Bucket Policy

1. En la misma pestaña **"Permissions"**, baja hasta **"Bucket policy"**
2. Haz clic en **"Edit"**
3. Pega esta política (reemplaza `TU-NOMBRE-DE-BUCKET` con tu nombre real):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::TU-NOMBRE-DE-BUCKET/*"
        }
    ]
}
```

4. Clic en **"Save changes"**

### Paso 3: Habilitar Static Website Hosting

1. Ve a la pestaña **"Properties"** (Propiedades)
2. Baja hasta **"Static website hosting"**
3. Haz clic en **"Edit"**
4. Selecciona **"Enable"**
5. Configura:
   - **Index document:** `index.html`
   - **Error document:** `index.html` (para React Router)
6. Clic en **"Save changes"**
7. **Copia la URL del endpoint** que aparece (algo como: `http://tu-bucket.s3-website-us-east-1.amazonaws.com`)

### Paso 4: Verificar Estructura de Archivos

Los archivos en tu bucket deben estar en la raíz:

```
tu-bucket/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── otros archivos...
├── favicon.ico
└── favicon.png
```

**Si están en una subcarpeta como `deploy/frontend/`, muévelos a la raíz.**

### Paso 5: Subir Archivos desde CodeBuild

Modifica tu `buildspec.yml` para incluir deployment a S3:

```yaml
post_build:
  commands:
    - echo "Desplegando a S3..."
    - aws s3 sync dist/ s3://TU-NOMBRE-DE-BUCKET/ --delete
    - aws s3 cp s3://TU-NOMBRE-DE-BUCKET/index.html s3://TU-NOMBRE-DE-BUCKET/index.html --metadata-directive REPLACE --cache-control max-age=0,no-cache,no-store,must-revalidate --content-type text/html
```

### Paso 6: Agregar Permisos a CodeBuild

Tu proyecto de CodeBuild necesita un rol IAM con estos permisos:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::TU-NOMBRE-DE-BUCKET",
                "arn:aws:s3:::TU-NOMBRE-DE-BUCKET/*"
            ]
        }
    ]
}
```

## Verificación

Después de aplicar estos cambios:

1. Accede a la URL del endpoint de S3
2. Abre las DevTools (F12)
3. Ve a la pestaña **Network**
4. Recarga la página
5. Verifica que los archivos `.js` y `.css` ahora devuelvan **200 OK** en lugar de **403 Forbidden**

## Mejoras Futuras (Opcional)

### Agregar CloudFront

Para mejor rendimiento y HTTPS:

1. Crea una distribución de CloudFront
2. Origen: Tu bucket S3
3. Configura HTTPS con certificado SSL
4. Usa la URL de CloudFront en lugar de la URL de S3

### Variables de Entorno

Si necesitas diferentes configuraciones para producción, crea un archivo `.env.production`:

```env
VITE_API_URL=https://api.tudominio.com
VITE_POSTHOG_KEY=tu-key-de-produccion
VITE_POSTHOG_HOST=https://app.posthog.com
```

## Troubleshooting

### Problema: Aún obtengo 403
**Solución:** Verifica que los permisos del bucket estén correctos y que la política esté aplicada.

### Problema: Las rutas de React Router no funcionan
**Solución:** Asegúrate de que el "Error document" también sea `index.html` en la configuración de Static Website Hosting.

### Problema: Los archivos no se actualizan
**Solución:** Agrega cache-control headers o invalida el caché de CloudFront si lo estás usando.

## Contacto

Si encuentras problemas, revisa:
- Los logs de CodeBuild
- La consola de S3
- Las DevTools del navegador (pestaña Network)


