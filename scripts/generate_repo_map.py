#!/usr/bin/env python3
"""
generate_repo_map.py — Generates `repo_map.md` at project root.

What it does:
  1. Builds a directory tree (excluding noise dirs).
  2. For every "code file", reads the first 15 lines and includes them
     as a fenced code block.
  3. Writes everything into REPO_MAP.md.

Code files = .ts, .tsx, .js, .jsx, .py, .css, .html
Config files  = .toml, .yaml, .yml
Config JSONs  = only those NOT in lesson_engine/ or i18n/ (excludes data JSONs)

Usage:
  python3 scripts/generate_repo_map.py
"""

import os
import fnmatch

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(PROJECT_ROOT, "repo_map.md")

EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", "dist",
    ".vercel", ".pytest_cache", ".claude", ".ruff_cache",
}

EXCLUDE_PATTERNS = [
    "*.pyc", "*.pyo", "*.DS_Store", "*.lock", "*.log",
    "package-lock.json",
]

EXCLUDE_DIR_PATTERNS = [
    "littlefounders_lessons_v1_backup_*",
]

CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".py", ".css", ".html"}
CONFIG_EXTENSIONS = {".toml", ".yaml", ".yml"}
JSON_EXTENSION = {".json"}

# Segments in path that indicate a "data JSON" directory (not config)
DATA_JSON_DIR_SEGMENTS = [
    "lesson_engine/littlefounders_lessons",
    "i18n/locales",
]

MAX_LINES = 15


def should_exclude_dir(name, rel_path):
    if name in EXCLUDE_DIRS:
        return True
    for pat in EXCLUDE_DIR_PATTERNS:
        if fnmatch.fnmatch(name, pat):
            return True
    return False


def is_data_json(rel_path):
    """Return True if this JSON file is data (lesson data, translations, etc.)."""
    for seg in DATA_JSON_DIR_SEGMENTS:
        if seg in rel_path:
            return True
    return False


def get_directory_tree(startpath):
    lines = []
    for root, dirs, files in os.walk(startpath):
        rel = os.path.relpath(root, startpath)
        if rel == ".":
            depth = 0
        else:
            depth = rel.count(os.sep) + 1

        dirs[:] = [d for d in dirs if not should_exclude_dir(d, os.path.join(rel, d))]

        indent = "    " * depth
        if depth == 0:
            lines.append(f"{os.path.basename(startpath)}/")
        else:
            lines.append(f"{indent}{os.path.basename(root)}/")

        for f in sorted(files):
            ext = os.path.splitext(f)[1].lower()
            if ext in CODE_EXTENSIONS and not any(fnmatch.fnmatch(f, p) for p in EXCLUDE_PATTERNS):
                lines.append(f"{indent}    {f}")
            elif ext in CONFIG_EXTENSIONS:
                lines.append(f"{indent}    {f}")
            elif ext in JSON_EXTENSION:
                file_rel = os.path.join(rel, f)
                if not is_data_json(file_rel):
                    lines.append(f"{indent}    {f}")

    return "\n".join(lines)


def get_file_preview(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            lines = []
            for i, line in enumerate(f):
                if i >= MAX_LINES:
                    break
                lines.append(line.rstrip("\n"))
        content = "\n".join(lines)

        LANG_MAP = {
            ".py": "python",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".js": "javascript",
            ".jsx": "javascript",
            ".css": "css",
            ".html": "html",
            ".json": "json",
            ".toml": "toml",
            ".yaml": "yaml",
            ".yml": "yaml",
        }
        lang = LANG_MAP.get(ext, "")
        return f"```{lang}\n{content}\n```"
    except Exception as e:
        return f"*Error reading file: {e}*"


def should_skip_file(rel_path):
    name = os.path.basename(rel_path)
    for pat in EXCLUDE_PATTERNS:
        if fnmatch.fnmatch(name, pat):
            return True
    return False


def collect_code_files(startpath):
    files = []
    for root, dirs, fnames in os.walk(startpath):
        rel = os.path.relpath(root, startpath)
        dirs[:] = [d for d in dirs if not should_exclude_dir(d, os.path.join(rel, d))]

        for f in sorted(fnames):
            ext = os.path.splitext(f)[1].lower()
            if ext in CODE_EXTENSIONS and not should_skip_file(f):
                full = os.path.join(root, f)
                rel_path = os.path.relpath(full, startpath)
                files.append((rel_path, full, "Code"))
            elif ext in CONFIG_EXTENSIONS and not should_skip_file(f):
                full = os.path.join(root, f)
                rel_path = os.path.relpath(full, startpath)
                files.append((rel_path, full, "Config"))
            elif ext in JSON_EXTENSION and not should_skip_file(f):
                full = os.path.join(root, f)
                rel_path = os.path.relpath(full, startpath)
                if not is_data_json(rel_path):
                    files.append((rel_path, full, "Config"))

    return sorted(files, key=lambda x: x[0])


def main():
    tree = get_directory_tree(PROJECT_ROOT)
    files = collect_code_files(PROJECT_ROOT)

    with open(OUTPUT, "w", encoding="utf-8") as out:
        out.write("# repo_map.md — LittleFounders AI Repository Map\n\n")
        out.write("> **Generado por:** `scripts/generate_repo_map.py`  \n")
        out.write("> **Propósito:** Índice completo del repositorio con firma de cada archivo de código.\n")
        out.write("> Cada archivo muestra las primeras 15 líneas (imports, clases, funciones).\n")
        out.write("> **Instrucción para agentes AI:** Este archivo es el punto de entrada.\n")
        out.write("> Ubica la ruta que necesitas y luego lee el archivo completo con la herramienta `Read`.\n\n")
        out.write("---\n\n")

        out.write("## Directorio\n\n")
        out.write("```\n")
        out.write(tree)
        out.write("\n```\n\n")
        out.write("---\n\n")

        code_count = len([f for f in files if f[2] == "Code"])
        config_count = len([f for f in files if f[2] == "Config"])

        out.write("## Archivos de Código (primeras 15 líneas cada uno)\n\n")
        out.write(f"**{code_count} archivos de código** + **{config_count} archivos de configuración**\n\n")

        for rel_path, full_path, label in files:
            out.write(f"### `{rel_path}` ({label})\n\n")
            preview = get_file_preview(full_path)
            out.write(preview)
            out.write("\n\n")

    print(f"repo_map.md generado en {OUTPUT}")
    print(f"   {code_count} code files + {config_count} config files = {len(files)} total")

    # Stats for regenerating
    print(f"\nPara regenerar: python3 scripts/generate_repo_map.py")


if __name__ == "__main__":
    main()
