# Skill: notebooklm-py — uso en el Lesson Factory

> **Referencia completa y autoritativa → [`SKILL.md`](SKILL.md)** (en esta carpeta).
> Es el skill **empaquetado por la librería** (`notebooklm agent show claude`), **versión-matcheado** con la instalada (v0.7.2). Cubre TODO el surface: comandos, generación de artefactos, patrones de subagente para llamadas largas, formatos JSON (`--json` + `jq`), exit codes, manejo de errores, idiomas y límites conocidos. **Para cualquier uso real de la API, empieza por `SKILL.md`.**
>
> Este README solo añade lo **específico de nuestro proyecto**: dónde está instalado y cómo usar las credenciales locales.

---

## Para qué la usamos

*Grounding* del Lesson Factory: NotebookLM ingiere material fuente curado (PDFs, URLs, docs) y `notebooklm-py` nos da acceso programático para consultarlo con citas y generar artefactos. Fundamentar la generación en fuentes reales → más calidad incluso con modelos económicos.

> ⚠️ API **NO oficial** (Playwright + endpoints internos de Google). Frágil: Google puede romper endpoints sin aviso. Envolver llamadas con timeout/retry y degradar con gracia.

## Instalación (ya hecha)

- venv: `backend/lesson_factory/.venv` (Python 3.11) · paquete `notebooklm-py[browser]` v0.7.2 (gitignored).
- CLI: `backend/lesson_factory/.venv/bin/notebooklm` (o `source .venv/bin/activate`).
- Librería: `from notebooklm import NotebookLMClient`.

## Credenciales — DÓNDE están y CÓMO usarlas

Las credenciales son **cookies de sesión de Google** (acceso total a la cuenta `jesusv@littlefounders.ai`). **NUNCA comitear.** Hay **dos copias**, ambas gitignored:

| Copia | Ruta | Notas |
|-------|------|-------|
| **Default** (la que escribe `login`) | `~/.notebooklm/profiles/default/storage_state.json` | Fuera del repo. La fuente de verdad tras cada login/refresh. |
| **In-folder** (portátil, este repo) | `backend/lesson_factory/.notebooklm/storage_state.json` | `chmod 600`, gitignored. Copia manual de la default. |

**Usar la copia in-folder explícitamente** (corriendo desde `backend/lesson_factory/`):

```bash
# CLI — flag global --storage
./.venv/bin/notebooklm --storage .notebooklm/storage_state.json auth check --test --json
./.venv/bin/notebooklm --storage .notebooklm/storage_state.json list
```

```python
# Librería — argumento path de from_storage()
from notebooklm import NotebookLMClient
async with NotebookLMClient.from_storage(
    path="backend/lesson_factory/.notebooklm/storage_state.json"
) as client:
    ...
```

> Alternativa: env `NOTEBOOKLM_HOME=<dir>` reubica todo el árbol de perfiles.

### Refrescar credenciales (expiran)

Las cookies caducan. Cuando `auth check` falle:

```bash
# A) keepalive rápido (default location)
./.venv/bin/notebooklm auth refresh --quiet

# B) re-login interactivo (abre Chrome; en macOS 15+ usar --browser chrome)
#    Para que la copia in-folder quede autoritativa y NO haya que re-copiar:
./.venv/bin/notebooklm login --browser chrome --storage .notebooklm/storage_state.json

# C) si refrescaste la default, re-copiar a la in-folder:
cp ~/.notebooklm/profiles/default/storage_state.json .notebooklm/storage_state.json && chmod 600 .notebooklm/storage_state.json
```

> ⚠️ **La copia in-folder NO se auto-actualiza** cuando refrescas la default. Si auth falla con `--storage .notebooklm/...`, re-copia (opción C) o re-loguéate apuntando a esa ruta (opción B).

## Quickstart (lo demás está en `SKILL.md`)

```bash
cd backend/lesson_factory
S=".notebooklm/storage_state.json"
./.venv/bin/notebooklm --storage $S create "LF grounding — banda 1"
./.venv/bin/notebooklm --storage $S source add "./fuente.pdf"
./.venv/bin/notebooklm --storage $S ask "Lista los conceptos clave de educación financiera para niños de 5-7 años"
# Generar artefacto (long-running → usar artifact wait / --json; ver SKILL.md)
./.venv/bin/notebooklm --storage $S generate quiz "vocabulario básico de ahorro"
```

## Gotchas de nuestro entorno

- **macOS 26 (Darwin 25 = macOS 15+):** el Chromium incluido crashea → login con `--browser chrome` (Google Chrome del sistema, instalado).
- **Async-first:** la librería es `async`; el CLI es el atajo síncrono.
- **Login interactivo no automatizable:** requiere un humano una vez; después `auth refresh` mantiene la sesión.
- **Verificar `git status` tras cualquier login/refresh** — nunca debe aparecer `storage_state.json` ni `.notebooklm/`.
