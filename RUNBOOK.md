# RUNBOOK.md — Respuesta a Incidentes

> **Propósito:** Procedimientos documentados para diagnosticar y resolver incidentes comunes.

---

## 1. Health Check

```bash
curl https://api.littlefounders.ai/health
# Expected: {"status": "ok", "database": "connected"}
```

## 2. Backend Caído

```bash
# 1. Verificar logs en Render dashboard
# 2. Verificar health endpoint
curl https://api.littlefounders.ai/health

# 3. Verificar conectividad DB
#    Revisar Supabase dashboard → Database → Connection pooling

# 4. Verificar variables de entorno en Render
#    Dashboard → Environment Variables
#    Especialmente: DATABASE_HOSTNAME, DATABASE_PASSWORD, SECRET_KEY
```

## 3. Frontend Caído

```bash
# 1. Verificar Vercel dashboard → Deployments
# 2. Verificar que el build no tenga errores
cd frontend && npm run build

# 3. Verificar variables VITE_ en Vercel
#    Project Settings → Environment Variables
```

## 4. Base de Datos Lenta

```sql
-- Verificar conexiones activas
SELECT pid, state, query_start, wait_event, query
FROM pg_stat_activity
WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%';

-- Verificar consultas lentas
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## 5. Rate Limiting

Si los usuarios reportan errores 429:
```python
# Verificar configuración en utils/limiter.py
# Ajustar límite global o por endpoint
```

## 6. Rollback de Contenido (Admin)

```bash
# Usar el panel admin → History → Rollback
# O vía API:
curl -X POST https://api.littlefounders.ai/admin/history/{id}/rollback \
  -H "Authorization: Bearer {token}"
```

## 7. Repositorio

```bash
# Revertir último commit
git revert HEAD

# Reset a commit específico
git reset --hard <commit-hash>
```
