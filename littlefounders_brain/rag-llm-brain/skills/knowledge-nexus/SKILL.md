---
name: knowledge-nexus
description: >
  Pipeline de ingesta→grafo de conocimiento con Neo4j. Ingiere contenido de multiples fuentes
  (Notion, Pocket, web), extrae entidades/topicos via LLM, genera embeddings, construye un
  knowledge graph enriquecido en Neo4j, y ofrece Q&A via Streamlit. En este proyecto, se toma
  como referencia la mecanica de ingest→chunk→embed con metadata en cada chunk (el patron
  "metadata-en-embedding" que inspira nuestro firewall anti-fuga). No se usa como motor activo.
  Activar cuando se trabaje en chunking, pipelines de ingest, metadata denormalizada en chunks,
  o se evaluen patrones de graph-building.
---

# Knowledge Nexus — Pipeline Ingest→Grafo de Conocimiento (Referencia)

> **Fuente:** https://github.com/Jallermax/knowledge-nexus (GPL v3, Jallermax)
> **Copia local:** source completo en `config/`, `graph_rag/`, `main.py`
> **Estado en este proyecto:** Referencia de patrones (NO se ejecuta como servicio activo).
> Ver BRAIN_STRATEGY.md §3 (chunking + firewall anti-fuga).

## Que es Knowledge Nexus

Knowledge Nexus es un sistema de gestion de conocimiento personal que transforma contenido digital
en un **grafo de conocimiento enriquecido** en Neo4j. El flujo:

```
Fuentes (Notion, Pocket, Web) → Pipeline de Procesamiento → Neo4j Knowledge Graph → Q&A (Streamlit)
                                       │
                                       ├── Content Chunking
                                       ├── Entity Extraction (LLM)
                                       ├── Topic Modeling
                                       ├── Clusterization
                                       └── Embedding Generation
```

## Arquitectura del pipeline (6 etapas)

```
graph_rag/
├── data_source/        # Providers pluggables: NotionProvider, (Pocket, Web: planeados)
├── pipeline/           # Orquestador: DataProcessingPipeline
├── processor/          # ContentChunkerAndEmbedder, GraphBuilder
├── storage/            # Neo4jManager (conexion, queries, limpieza)
├── ai_agent/           # LLM wrapper (OpenAI gpt-4o-mini por defecto)
├── data_model/         # Modelos de datos (nodos, edges, chunks)
├── config/             # Configuracion del pipeline
└── utils/              # Helpers
```

El `main.py` orquesta todo:

```python
pipeline = DataProcessingPipeline()
pipeline.add_data_source(NotionProvider())
pipeline.add_processor(ContentChunkerAndEmbedder())
pipeline.add_processor(GraphBuilder())
pipeline.run()
```

## Lo que tomamos de Knowledge Nexus en este proyecto

### 1. Patron "metadata-en-embedding" (CRITICO)

Knowledge Nexus denormaliza metadata en cada chunk/embedding para permitir filtrado en retrieval.
Este patron es la base de nuestro **firewall anti-fuga**:

```python
# Cada chunk lleva toda la metadata necesaria para filtrado
chunk = {
    "text": "...",
    "embedding": [...],
    "metadata": {
        "source_id": "...",
        "page_title": "...",
        "section": "...",
        "topics": [...],
        "entities": [...],
    }
}
```

En nuestro caso, la metadata obligatoria por chunk es:

```python
# Nuestro firewall (inspirado en Knowledge Nexus)
chunk_metadata = {
    "country": "mx",           # FILTRO DURO
    "language": "es",          # FILTRO DURO
    "jurisdiction": "MX-FED",
    "domain": "taxes",
    "subdomain": "iva",
    "concept_ids": ["tax.consumption.vat"],
    "age_band": ["tier3", "tier4"],
    "depth_tier": "intermediate",
    "volatility": "high",
    "last_verified_date": "2026-06-19",
    "review_due": "2026-09-19",
    "source_ids": ["src_sat_iva_2026"],
}
```

### 2. Pipeline modular de procesamiento

El patron `DataProcessingPipeline` con providers y processors pluggables inspira nuestra
arquitectura de tools en `knowledge/tools/`:

- Cada tool es un paso independiente del pipeline
- Se pueden ejecutar individualmente o en cadena
- El gate (`gate_kb.py`) es un "processor" que valida antes de persistir

### 3. Chunking por estructura (no por ancho fijo)

Knowledge Nexus chunking respeta la estructura del contenido. En nuestro caso, esto se traduce
en cortar por encabezados markdown (`##`/`###`), un chunk por seccion hoja, 300-600 tokens,
tope ~800. Nunca fusionar chunks entre documentos ni entre paises.

## Diferencias clave con nuestro enfoque

| Aspecto | Knowledge Nexus | Nuestro proyecto |
|---------|----------------|------------------|
| **Storage** | Neo4j (grafo) | SQLite-vec + FTS5 (híbrido, $0, git-amigable) |
| **Filtrado** | Post-retrieval | Pre-filtro DURO `country` + `language` |
| **Ingesta** | Notion API + LLM extraction | NotebookLM + autoría Qwen + juez GLM |
| **Determinismo** | No determinista (LLM extrae entidades) | Determinista (gate compara valores canónicos) |
| **Versionabilidad** | Neo4j binario | Markdown + YAML en git |
| **Q&A UI** | Streamlit | Futuro chatbot |
| **Embeddings** | OpenAI text-embedding-3-large | bge-m3 local (multilingüe, $0) |

## Configuracion de referencia

El `config/config.yaml` local muestra la configuracion por defecto:

```yaml
neo4j:
  uri: bolt://localhost:7687
  user: neo4j
  password: neo4j

llm:
  model: gpt-4o-mini
  temperature: 0.7
  max_tokens: 150

embeddings:
  model: text-embedding-3-large
  dimensions: 3072
  max_tokens: 2000
  overlap: 200
```

> **No ejecutar con estos valores en prod.** Son defaults de desarrollo. Nuestro pipeline usa
> fastembed multilingue y modelos economicos (Qwen, DeepSeek, GLM).

## Instalacion (solo para experimentacion, NO para prod)

```bash
# Requisitos: Neo4j + Python 3.10+
cd skills/knowledge-nexus
pip install -r requirements.txt
# Configurar .env desde .env.example
python main.py

# Q&A (requiere datos ya procesados)
python -m streamlit run app_st.py
```

## Cuando activar esta skill

- Al diseñar o modificar el pipeline de **chunking** (`knowledge/tools/build_dataset.py`)
- Al trabajar en **metadata denormalizada** por chunk (firewall anti-fuga)
- Al evaluar patrones de **graph-building** para un futuro chatbot
- Al comparar enfoques de **pipeline modular** (providers + processors)
- Al considerar **fuentes de datos alternativas** (Notion, Pocket, etc.)

## Lo que NO tomar de Knowledge Nexus

- **Post-filtrado:** su retrieval filtra despues de la busqueda; nosotros exigimos pre-filtrado
- **Neo4j como storage principal:** muy pesado para nuestro caso; SQLite-vec es suficiente
- **Extraccion de entidades via LLM como verdad:** nuestro `facts.yaml` es la verdad, no consenso LLM
- **Streamlit como UI:** es un prototipo; nuestro chatbot sera parte del producto

## Relacion con las demas skills

| Skill | Relacion con Knowledge Nexus |
|-------|------------------------------|
| `notebooklm-py/` | NotebookLM reemplaza la fase de descubrimiento/extraccion de Knowledge Nexus |
| `lightrag/` | Ambos usan grafos de conocimiento; LightRAG es mas maduro, Knowledge Nexus mas simple |
| `obsidian-second-brain/` | El esquema markdown+frontmatter es compatible con el pipeline de ingest |
