---
name: lightrag
description: >
  Motor RAG grafo+vector dual-layer (Knowledge Graph + embeddings). LightRAG indexa documentos
  extrayendo entidades y relaciones en un grafo de conocimiento, y los recupera via 5 modos de
  query (local, global, hybrid, naive, mix). EN REPSA en este proyecto: su grafo inventa
  relaciones cross-documento (= fuga de jurisdiccion MX<->US), no filtra nativamente por metadata
  country/language, la ingesta es cara/no-determinista, y los artefactos no son versionables en git.
  Reconsiderar SOLO si se requiere razonamiento multi-salto. Activar cuando se evaluen motores
  RAG alternativos, se discuta arquitectura de retrieval, o se necesite comparar enfoques
  grafo-primero vs vector-primero.
---

# LightRAG — Motor RAG Grafo+Vector (En Repisa)

> **Fuente:** https://github.com/hkuds/LightRAG (MIT, HKUDS)
> **Version incluida:** copia local del source en `lightrag/` (para referencia offline del agente)
> **Estado en este proyecto:** EN REPSISA — NO se usa como motor de retrieval. Ver BRAIN_STRATEGY.md §0 (decision D2).

## Que es LightRAG

LightRAG es un framework RAG ligero basado en grafos de conocimiento, alternativa a Microsoft
GraphRAG. Usa arquitectura dual-layer: un **Knowledge Graph** (entidades + relaciones) y
**vector embeddings**, combinando ambos en la recuperacion. Acepta 5 modos de query:

| Modo | Descripcion | Use case |
|------|-------------|----------|
| `local` | Entidades especificas y su contexto directo | Q&A sobre objetos concretos |
| `global` | Temas macro, razonamiento cross-documento | Resumenes, analisis de tendencias |
| `hybrid` | Fusion local + global | Queries que necesitan ambos niveles |
| `naive` | Solo vector similarity (sin grafo) | Basica tipo RAG tradicional |
| `mix` | local + global + naive (default) | Mas comprensivo, ligeramente mas lento |

## Por que NO usamos LightRAG como motor (Decision D2)

Razones criticas para este proyecto:

1. **Fuga de jurisdiccion:** Su grafo inventa relaciones cross-documento automaticamente. En nuestro
   caso, esto significa que conectaria documentos MX con US — el modo de fallo mas peligroso para un
   corpus financiero/fiscal bilingue donde mezclar jurisdicciones es HARD-FAIL.

2. **Sin filtrado nativo por metadata:** No soporta pre-filtro obligatorio `country` + `language`
   antes de la busqueda vectorial. Nuestro retriever exige `WHERE country IN (target,'shared')
   AND language=target` ANTES del scoring — post-filtrado es inaceptable.

3. **Ingesta cara y no determinista:** La extraccion de entidades/relaciones via LLM es costosa y
   no reproducible entre ejecuciones. Nuestro corpus markdown es determinista y versionable en git.

4. **Artefactos no versionables:** Los grafos generados son binarios/JSON opacos que no se pueden
   auditar en diff de git. Nuestro corpus markdown + frontmatter YAML es legible y auditable.

## Cuando reconsiderar

LightRAG podria volver a la mesa si:

- Se necesita **razonamiento multi-salto** (ej. "que impuestos afectan a un freelancer en MX que
  tambien tiene ingresos US?") que el retriever plano no resuelve.
- Se implementa un **filtro de metadata duro** como capa adicional sobre LightRAG (wrapper custom).
- Se acepta el costo de ingesta y se aisla el grafo por jurisdiccion (un graph MX, un graph US).

Cualquier re-evaluacion debe pasar por BRAIN_STRATEGY.md y aprobarse como cambio de decision D2.

## Stack tecnico (para referencia)

- **Python 3.10+** con `uv` para package management
- **LLM roles:** 4 roles independientes (EXTRACT, QUERY, KEYWORDS, VLM) con configuracion separada
- **Storage backends:** KV, Vector, Graph, Doc Status — cada uno configurable
  (PostgreSQL, MongoDB, Neo4j, Milvus, Qdrant, Redis, OpenSearch, etc.)
- **Embedding:** requiere modelo fijo antes de indexar (no se puede cambiar sin re-embedder todo)
- **Reranker:** opcional, mejora calidad en queries mixtos (+1-2s latencia)
- **Multimodal:** desde v1.5, soporte para PDFs/imagenes/tablas/formulas via MinerU/Docling
- **API Server:** REST API + Web UI para explorar el knowledge graph
- **Chunking:** 4 estrategias (Fix, Recursive, Vector, Paragraph)

## Instalacion (si se activa)

```bash
# SDK basico
pip install lightrag-hku

# Con API server
pip install "lightrag-hku[api]"

# Con storage backends offline
pip install -r requirements-offline-storage.txt

# Con LLM providers offline
pip install -r requirements-offline-llm.txt

# Desde source (la copia local)
cd skills/lightrag
uv sync
```

## Uso como SDK (ejemplo rapido)

```python
from lightrag import LightRAG, QueryParam

rag = LightRAG(working_dir="./workspace")

# Indexar documentos
with open("doc.txt") as f:
    rag.insert(f.read())

# Query en distintos modos
result_local = rag.query("Que es el IVA?", mode="local")
result_global = rag.query("Tendencias de impuestos en Mexico", mode="global")
result_mix = rag.query("Comparar ISR Mexico vs income tax US", mode="mix")
```

## Uso como API Server

```bash
# Configurar .env
cp env.example .env  # Actualizar con LLM + embedding configs

# Lanzar servidor
lightrag-server

# O via Docker
docker compose up
```

## Referencia rapida de configuracion clave

| Variable | Proposito | Nota |
|----------|-----------|------|
| `MAX_ASYNC_LLM` | Concurrencia maxima LLM | ~8 para produccion |
| `MAX_PARALLEL_INSERT` | Archivos en paralelo | ~1/3 de MAX_ASYNC_LLM |
| `EMBEDDING_FUNC_MAX_ASYNC` | Concurrencia embedding | ~16 |
| `SUMMARY_LANGUAGE` | Idioma de salida del grafo | `English` o `Spanish` |
| `ENTITY_EXTRACTION_USE_JSON` | Salida JSON de extraccion | Mas estable, mas tokens |
| `MAX_ENTITY_TOKENS` / `MAX_RELATION_TOKENS` | Token limites en contexto de query | Ajustar segun modelo |

## Lo que podriamos tomar de LightRAG

Incluso sin usarlo como motor, hay patrones utiles:

- **Dual-layer retrieval:** la idea de combinar busqueda local (entidades) y global (temas) es
  relevante. Nuestro retriever podria beneficiarse de un segundo nivel de busqueda por conceptos
  ademas de chunks.
- **Role-specific LLM config:** separar modelos por tarea (extraccion vs query vs keywords) es
  una buena practica que ya aplicamos con DeepSeek/Qwen/GLM.
- **Incremental updates:** su mecanismo de merge de grafos sin rebuild completo es interesante
  para cuando el corpus crezca.
- **Reranking:** la integracion de rerankers como paso post-retrieval es algo a considerar.

## Relacion con las demas skills

| Skill | Relacion con LightRAG |
|-------|----------------------|
| `notebooklm-py/` | NotebookLM es el "buscador" (extraccion); LightRAG seria el motor (si se activa) |
| `knowledge-nexus/` | Comparte el enfoque grafo+embeddings, pero Knowledge Nexus usa Neo4j directo |
| `obsidian-second-brain/` | El esquema markdown+frontmatter del corpus es compatible con ambos enfoques |
