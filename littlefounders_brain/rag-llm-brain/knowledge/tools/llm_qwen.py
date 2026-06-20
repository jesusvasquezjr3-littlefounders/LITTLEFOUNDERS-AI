#!/usr/bin/env python3
"""
llm_qwen.py — cliente Qwen (Alibaba Model Studio, OpenAI-compatible) para los roles LLM del
pipeline autónomo. Sólo stdlib (urllib) → corre en cualquier venv sin instalar dependencias.

Roles (para NO consumir tokens de Claude): planner, author, judge, verifier.
Capacidades: JSON mode, web grounding (`enable_search`), retry con backoff, tracking de uso.

Credenciales: lee `littlefounders_brain/.env` (gitignored). NUNCA imprime la API key.

Uso programático:
    from llm_qwen import Qwen
    q = Qwen()
    txt = q.chat([{"role":"user","content":"..."}], model="qwen-plus-latest")
    obj = q.json([...], model="qwen-plus-latest", enable_search=True)   # dict validado
    print(q.usage)   # {'calls':N,'prompt_tokens':..,'completion_tokens':..}
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

BRAIN = Path(__file__).resolve().parent.parent.parent          # littlefounders_brain/
ENV = BRAIN / ".env"


def _load_env() -> dict:
    out = {}
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


class QwenError(RuntimeError):
    pass


class Qwen:
    def __init__(self, env: dict | None = None):
        env = env or _load_env()
        self.key = env.get("QWEN_API_KEY")
        self.base = (env.get("QWEN_BASE_URL") or "").rstrip("/")
        if not self.key or not self.base:
            raise QwenError("Faltan QWEN_API_KEY / QWEN_BASE_URL en littlefounders_brain/.env")
        self.usage = {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0}

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
        payload = {"model": model, "messages": messages, "temperature": temperature}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if enable_search:
            payload["enable_search"] = True
        if max_tokens:
            payload["max_tokens"] = max_tokens

        last = None
        for attempt in range(max_retries):
            try:
                resp = self._post(payload, timeout)
                msg = resp["choices"][0]["message"]["content"]
                u = resp.get("usage", {})
                self.usage["calls"] += 1
                self.usage["prompt_tokens"] += u.get("prompt_tokens", 0)
                self.usage["completion_tokens"] += u.get("completion_tokens", 0)
                return msg
            except urllib.error.HTTPError as e:
                last = e
                code = e.code
                body = e.read().decode("utf-8", "ignore")[:200]
                if code in (429, 500, 502, 503, 504):
                    time.sleep(min(2 ** attempt * 3, 60))   # backoff
                    continue
                raise QwenError(f"HTTP {code}: {body}") from e
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                last = e
                time.sleep(min(2 ** attempt * 3, 60))
                continue
        raise QwenError(f"Agotados {max_retries} reintentos: {last}")

    def json(self, messages, **kw) -> dict:
        """Como chat() pero garantiza JSON mode y parsea el resultado a dict (con limpieza)."""
        kw["json_mode"] = True
        raw = self.chat(messages, **kw)
        return _parse_json(raw)


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
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
    q = Qwen()
    model = sys.argv[2] if len(sys.argv) > 2 else "qwen-plus-latest"
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Di 'ok' y nada más."
    print(q.chat([{"role": "user", "content": prompt}], model=model))
    print("usage:", q.usage)
