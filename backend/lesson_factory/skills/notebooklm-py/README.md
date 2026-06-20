# Skill: notebooklm-py (API no oficial de NotebookLM)

> **Para qué la usamos:** *grounding* del Lesson Factory. NotebookLM ingiere material fuente curado (PDFs, URLs, docs) y `notebooklm-py` nos da acceso **programático** (Python/CLI) para consultar ese material con citas y generar artefactos. Esto fundamenta la generación de lecciones en fuentes reales → más calidad incluso con modelos económicos.

- **Repo:** https://github.com/teng-lin/notebooklm-py
- **Naturaleza:** **NO oficial**, usa endpoints internos de Google vía automatización de navegador (**Playwright**). Puede romperse si Google cambia su UI/API. Tratar como dependencia frágil: para prototipos/research, con manejo de errores defensivo.
- **Instalación local del proyecto:** venv en `backend/lesson_factory/.venv` (Python 3.11). Las credenciales y el venv están en el `.gitignore` de la carpeta.

---

## 1. Instalación

Dentro de `backend/lesson_factory/`:

```bash
# venv local con Python 3.11 (el backend requiere 3.11: enum.StrEnum)
/opt/homebrew/bin/python3.11 -m venv .venv
source .venv/bin/activate
pip install "notebooklm-py[browser]"
```

El extra `[browser]` instala el soporte Playwright. En el **primer** `notebooklm login` se descarga Chromium (~170 MB).

> Alternativas del repo (no usadas aquí): `uv tool install "notebooklm-py[browser]"` o `pipx install "notebooklm-py[browser]"`. Preferimos venv local para mantener todo dentro de la carpeta.

## 2. Autenticación (requiere acción humana en el navegador)

```bash
notebooklm login                       # abre el navegador para iniciar sesión con Google
notebooklm login --browser msedge      # usar Edge (orgs con SSO)
notebooklm login --browser-cookies chrome            # reutilizar cookies de Chrome
notebooklm login --browser-cookies 'chrome::Profile 1'
```

- `notebooklm login` **abre una ventana** y guarda la auth **automáticamente** al detectar el login (no requiere interacción en la terminal). En automatización, correr en background y luego verificar con `auth check`.
- **macOS 15+ (este equipo):** el Chromium incluido puede crashear. Usar `notebooklm login --browser chrome` (Google Chrome del sistema) si está instalado; si no, `--browser-cookies chrome` (requiere `pip install 'notebooklm-py[cookies]'`).
- **Credenciales (ubicación real):** `~/.notebooklm/profiles/<profile>/storage_state.json` — **fuera del repo** por defecto (`<profile>` = `default`). Esto significa que **no hay riesgo de comitearlas**. Se puede overridear con `--storage PATH`. El `.gitignore` de la carpeta cubre además, de forma defensiva, el caso de que alguna credencial caiga dentro del repo (`.notebooklm/`, `storage_state*.json`, `*.cookies`, etc.). **NUNCA comitear credenciales:** verificar `git status` tras cualquier login.

Verificar / mantener sesión:

```bash
notebooklm auth check --test --json    # esperado: "status": "ok"
notebooklm auth refresh --quiet        # keepalive de cookies (cron/launchd)
notebooklm profile list                # perfiles multi-cuenta
notebooklm profile switch work
```

## 3. API de Python (async)

```python
import asyncio
from notebooklm import NotebookLMClient, MindMapKind

async def main():
    async with NotebookLMClient.from_storage() as client:   # usa credenciales guardadas
        # Notebooks
        nb = await client.notebooks.create("Research")
        # Fuentes (grounding)
        await client.sources.add_url(nb.id, "https://example.com", wait=True)
        await client.sources.add_file(nb.id, "./paper.pdf")
        # Chat con citas a las fuentes
        result = await client.chat.ask(nb.id, "Resume los puntos clave")
        print(result.answer)
        # Artefactos
        status = await client.artifacts.generate_quiz(nb.id)
        await client.artifacts.wait_for_completion(nb.id, status.task_id)
        await client.artifacts.download_quiz(nb.id, "quiz.json", output_format="json")

asyncio.run(main())
```

**Objetos principales del cliente:**
- `client.notebooks` — crear/listar/renombrar/eliminar notebooks.
- `client.sources` — añadir URLs, archivos, YouTube, Google Drive; obtener fulltext.
- `client.chat` — preguntar (con citas), historial de conversación. ← **lo más útil para grounding**.
- `client.artifacts` — generar/descargar audio, video, quiz, flashcards, slides, infografías, mind maps, data tables, reports.
- `client.mind_maps` — mind maps (`MindMapKind.INTERACTIVE` | `NOTE_BACKED`).
- `client.notes`, `client.sharing` — notas y permisos de compartición.

## 4. CLI (equivalente rápido)

```bash
# Notebooks / fuentes
notebooklm create "My Research"
notebooklm use <notebook_id>
notebooklm source add "https://example.com"
notebooklm source add "./paper.pdf"
notebooklm source add-research "AI"          # research web + importa fuentes

# Preguntar (grounding)
notebooklm ask "¿Cuáles son los temas clave?"
notebooklm ask --prompt-file ./pregunta.txt

# Generar / descargar artefactos
notebooklm generate quiz --difficulty hard
notebooklm generate flashcards --quantity more
notebooklm generate data-table "compara conceptos"
notebooklm generate report "prompt"          # briefing / study guide / blog
notebooklm download quiz --format json ./quiz.json
notebooklm download flashcards --format json ./cards.json

# Utilidades
notebooklm metadata --json
notebooklm language list
```

## 5. Integración con agentes (skills)

`notebooklm-py` **trae plantillas de skill** para agentes — útil para esta misma carpeta:

```bash
notebooklm agent show claude     # imprime una plantilla de skill para Claude Code
notebooklm agent show codex      # instrucciones para Codex
notebooklm skill install         # instala la skill de NotebookLM localmente
notebooklm skill status          # verifica instalación
```

> **TODO próximas iteraciones:** tras el primer login, correr `notebooklm agent show claude` y volcar su salida aquí para tener la plantilla canónica de la skill.

## 6. Gotchas

- **Frágil por diseño** (endpoints internos de Google). Envolver llamadas con timeout + retry; degradar con gracia si NotebookLM cambia.
- **Async-first:** la librería es `async`; usar `asyncio.run` o un loop. El CLI es el atajo síncrono.
- **Login interactivo:** no se puede automatizar el primer sign-in; requiere un humano una vez. Después, `auth refresh` mantiene la sesión.
- **No comitear credenciales** (ver §2). Verificar `git status` antes de cualquier commit tras un login.
- **Chromium ~170 MB** se descarga en el primer login (a la caché de Playwright, fuera del repo por defecto).
