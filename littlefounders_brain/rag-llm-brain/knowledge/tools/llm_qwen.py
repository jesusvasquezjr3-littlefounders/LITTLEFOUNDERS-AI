#!/usr/bin/env python3
"""
llm_qwen.py — cliente LLM MULTI-PROVEEDOR (OpenAI-compatible) para los roles del pipeline.

Aunque el nombre del archivo es histórico ("qwen"), esta es una clase GENÉRICA que habla con
cualquier endpoint OpenAI-compatible. Soporta tres proveedores:

  · provider="qwen"     → Alibaba Model Studio. Búsqueda web vía `enable_search=True`.
  · provider="glm"      → z.ai (Zhipu GLM). Búsqueda web vía tool `web_search` (formato z.ai).
  · provider="deepseek" → DeepSeek. SIN búsqueda web (la API nativa no la expone).

Diseño "uso sabio" (no consultas tontas):
  · CACHÉ de respuestas content-addressed: misma (provider, model, messages, params) ⇒ no se
    vuelve a llamar a la API. Hace el RESUME barato y evita re-pagar en re-ejecuciones.
  · La búsqueda web solo se activa cuando el rol la pide (autor/juez), nunca por defecto.
  · `usage` separa tokens REALES (prompt/completion) de `cached` (aciertos de caché).

Credenciales: lee `littlefounders_brain/rag-llm-brain/.env` (gitignored). NUNCA imprime la key.
  QWEN_API_KEY / QWEN_BASE_URL · DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL · ZAI_API_KEY / ZAI_BASE_URL

Uso programático:
    from llm_qwen import Qwen, provider_for
    q = Qwen(provider="glm")
    obj = q.json([...], model="glm-4.6", enable_search=True)   # dict validado, con búsqueda
    print(q.usage)   # {'calls':N,'prompt_tokens':..,'completion_tokens':..,'cached':M}
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

BRAIN = Path(__file__).resolve().parent.parent.parent          # littlefounders_brain/rag-llm-brain/
ENV = BRAIN / ".env"
CACHE_DIR = Path(__file__).resolve().parent.parent / "index" / "llm_cache"   # index/ está gitignored

# Endpoints por defecto (overridibles vía .env). z.ai expone OpenAI-compatible en /api/paas/v4.
DEFAULT_BASE = {
    "qwen": "",  # obligatorio en .env (varía por región)
    "deepseek": "https://api.deepseek.com",
    "glm": "https://api.z.ai/api/paas/v4",
}

# Formato de la herramienta de búsqueda web de z.ai (Zhipu). Los valores son strings ("True")
# por convención de su API. Confirmado contra docs.z.ai/guides/tools/web-search.
GLM_WEB_SEARCH_TOOL = {
    "type": "web_search",
    "web_search": {
        "enable": "True",
        "search_engine": "search-prime",
        "search_result": "True",
        "count": "5",
        "content_size": "high",
    },
}


def _load_env() -> dict:
    out = {}
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


def provider_for(model: str) -> str:
    """Deduce el proveedor a partir del nombre del modelo."""
    m = (model or "").lower()
    if m.startswith("glm"):
        return "glm"
    if m.startswith("deepseek"):
        return "deepseek"
    return "qwen"


class QwenError(RuntimeError):
    pass


class Qwen:
    """Cliente OpenAI-compatible multi-proveedor. Ver docstring del módulo."""

    def __init__(self, env: dict | None = None, provider: str = "qwen", cache: bool = True):
        env = env or _load_env()
        self.provider = provider
        self.cache = cache
        if provider == "deepseek":
            self.key = env.get("DEEPSEEK_API_KEY")
            self.base = (env.get("DEEPSEEK_BASE_URL") or DEFAULT_BASE["deepseek"]).rstrip("/")
            self.search_ok = False     # la API nativa de DeepSeek no tiene búsqueda web
            miss = "DEEPSEEK_API_KEY"
        elif provider == "glm":
            self.key = env.get("ZAI_API_KEY")
            self.base = (env.get("ZAI_BASE_URL") or DEFAULT_BASE["glm"]).rstrip("/")
            self.search_ok = True      # z.ai: búsqueda vía tool web_search
            miss = "ZAI_API_KEY"
        else:
            self.key = env.get("QWEN_API_KEY")
            self.base = (env.get("QWEN_BASE_URL") or DEFAULT_BASE["qwen"]).rstrip("/")
            self.search_ok = True       # Qwen: enable_search
            miss = "QWEN_API_KEY / QWEN_BASE_URL"
        if not self.key or not self.base:
            raise QwenError(f"Faltan {miss} en littlefounders_brain/rag-llm-brain/.env (provider={provider})")
        # usage es compartido entre workers (un cliente por rol) → toda mutación/lectura va bajo lock.
        self.usage = {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "cached": 0, "search_calls": 0}
        self._usage_lock = threading.Lock()

    def usage_snapshot(self) -> dict:
        """Copia consistente de usage (bajo lock) — segura para leer el costo mientras otros workers escriben."""
        with self._usage_lock:
            return dict(self.usage)

    # ── caché content-addressed ───────────────────────────────────────────────
    def _cache_key(self, payload: dict, enable_search: bool) -> str:
        blob = json.dumps({"prov": self.provider, "search": enable_search, "p": payload},
                          ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()

    def _cache_get(self, key: str):
        f = CACHE_DIR / f"{key}.json"
        if f.exists():
            try:
                return json.loads(f.read_text(encoding="utf-8"))["content"]
            except Exception:
                return None
        return None

    def _cache_put(self, key: str, content: str):
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = CACHE_DIR / f"{key}.json.tmp"
        tmp.write_text(json.dumps({"content": content}, ensure_ascii=False), encoding="utf-8")
        tmp.replace(CACHE_DIR / f"{key}.json")   # escritura atómica

    # ── llamada HTTP ──────────────────────────────────────────────────────────
    def _post(self, payload: dict, timeout: int) -> dict:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base}/chat/completions", data=data, method="POST",
            headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))

    def chat(self, messages, *, model="qwen-plus-latest", json_mode=False,
             enable_search=False, temperature=0.3, max_tokens=None,
             timeout=120, max_retries=4) -> str:
        payload: dict = {"model": model, "messages": messages, "temperature": temperature}
        want_search = bool(enable_search and self.search_ok)

        # JSON mode: response_format nativo SOLO donde es seguro. Con la búsqueda de GLM (tools)
        # evitamos response_format (puede chocar) y confiamos en el prompt + _parse_json.
        if json_mode and not (self.provider == "glm" and want_search):
            payload["response_format"] = {"type": "json_object"}

        if want_search:
            if self.provider == "qwen":
                payload["enable_search"] = True
            elif self.provider == "glm":
                payload["tools"] = [GLM_WEB_SEARCH_TOOL]
        if max_tokens:
            payload["max_tokens"] = max_tokens

        # Caché: misma petición ⇒ misma respuesta (no re-pagamos).
        ck = self._cache_key(payload, want_search) if self.cache else None
        if ck:
            hit = self._cache_get(ck)
            if hit is not None:
                with self._usage_lock:
                    self.usage["cached"] += 1
                return hit

        last = None
        for attempt in range(max_retries):
            try:
                resp = self._post(payload, timeout)
                msg = resp["choices"][0]["message"]["content"]
                u = resp.get("usage", {})
                with self._usage_lock:
                    self.usage["calls"] += 1
                    self.usage["prompt_tokens"] += u.get("prompt_tokens", 0)
                    self.usage["completion_tokens"] += u.get("completion_tokens", 0)
                    if want_search:                       # surcharge de búsqueda web (se cobra por llamada)
                        self.usage["search_calls"] += 1
                if ck and msg:
                    self._cache_put(ck, msg)
                return msg
            except urllib.error.HTTPError as e:
                last = e
                code = e.code
                body = e.read().decode("utf-8", "ignore")[:300]
                if code in (429, 500, 502, 503, 504):
                    time.sleep(min(2 ** attempt * 3, 60))   # backoff
                    continue
                # 4xx con tools de búsqueda: degradar a SIN búsqueda y reintentar una vez
                if want_search and "tools" in payload and attempt == 0:
                    payload.pop("tools", None)
                    want_search = False
                    continue
                raise QwenError(f"HTTP {code} ({self.provider}): {body}") from e
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                last = e
                time.sleep(min(2 ** attempt * 3, 60))
                continue
        raise QwenError(f"Agotados {max_retries} reintentos ({self.provider}): {last}")

    def json(self, messages, **kw) -> dict:
        """Como chat() pero garantiza JSON mode y parsea el resultado a dict (con limpieza)."""
        kw["json_mode"] = True
        raw = self.chat(messages, **kw)
        return _parse_json(raw)

    def ping(self, model: str, timeout: int = 30) -> str:
        """Smoke-test mínimo de conectividad+credenciales (sin caché). Devuelve el texto."""
        old = self.cache
        self.cache = False
        try:
            return self.chat([{"role": "user", "content": "Responde solo: ok"}],
                             model=model, max_tokens=5, timeout=timeout, max_retries=1)
        finally:
            self.cache = old


def _parse_json(raw: str) -> dict:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip().rstrip("`").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        s, e = raw.find("{"), raw.rfind("}")
        if s != -1 and e != -1:
            return json.loads(raw[s:e + 1])
        raise


if __name__ == "__main__":
    import sys
    model = sys.argv[2] if len(sys.argv) > 2 else "qwen-plus-latest"
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Di 'ok' y nada más."
    q = Qwen(provider=provider_for(model))
    print(q.chat([{"role": "user", "content": prompt}], model=model))
    print("usage:", q.usage)
