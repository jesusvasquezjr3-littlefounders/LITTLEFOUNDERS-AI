# Framework de Competencia Deliberativa - Bernheim

## Introducción

Este directorio implementa **estrictamente** el framework científico de **B. Douglas Bernheim** para educación financiera, basado en su investigación sobre "Competencia Deliberativa" ([video de referencia](https://www.youtube.com/watch?v=HK_djsf-_fM)).

### ¿Por qué este Framework?

Los programas tradicionales de educación financiera **no funcionan** porque:
- Se enfocan en cambios conductuales superficiales
- No miden efectos de bienestar reales
- Ignoran sesgos cognitivos sistemáticos
- Usan retórica motivacional en lugar de herramientas prácticas

### Principios Fundamentales

1. **COMPETENCIA DELIBERATIVA**: Medir qué tan bien los estudiantes alinean decisiones complejas con decisiones equivalentes transparentes
2. **SESGO MÉTRICO MONETARIO**: Diferencia entre valuaciones complejas vs. simples
3. **HERRAMIENTAS SUSTANTIVAS**: Conceptos calculables específicos, NO motivación general
4. **EFECTOS HETEROGÉNEOS**: Corrección de sesgos en ambas direcciones

---

## Estructura del Framework

### Componentes Base (`BernheimFrameworkComponents.tsx`)

#### `PairedTaskComponent`
- Presenta problemas **complejos** y **transparentes** equivalentes
- Mide diferencia entre respuestas (sesgo métrico)
- Proporciona retroalimentación inmediata específica

#### `PracticalTool`  
- Herramientas calculables interactivas
- Ejemplos de uso con explicaciones
- Aplicación directa a problemas reales

#### `CompetenceTracker`
- Mide progreso en reducción de sesgo
- Evalúa maestría de herramientas específicas
- Criterios objetivos de competencia

---

## Lecciones Implementadas

### 🎯 Edades 8-10: Fundamentos

#### Herramienta de Comparación de Valor
- **Herramienta**: `Precio ÷ Cantidad = Valor por unidad`
- **Objetivo**: Eliminar sesgo intuitivo en comparaciones
- **Métrica**: Sesgo < 0.1 puntos
- **Duración**: 20-25 minutos

#### Planificador de Metas de Ahorro
- **Herramienta**: `(Meta - Actual) ÷ Ahorro semanal = Semanas`
- **Objetivo**: Planificación temporal realista
- **Métrica**: Sesgo < 1.0 punto
- **Duración**: 20-25 minutos

### 🎯 Edades 11-13: Gestión

#### Herramienta de Presupuestación 50/30/20
- **Herramienta**: `50% necesidades, 30% deseos, 20% ahorros`
- **Objetivo**: Categorización y disciplina financiera
- **Métrica**: Sesgo < 0.5 puntos
- **Duración**: 25-30 minutos

#### Herramienta de Gasto Inteligente
- **Herramienta**: `Precio ÷ Usos esperados = Costo por uso`
- **Objetivo**: Evaluación racional de compras
- **Métrica**: Sesgo < 0.3 puntos
- **Duración**: 25-30 minutos

### 🎯 Edades 14-16: Nivel Profesional

#### La Regla del 72 - Interés Compuesto
- **Herramienta**: `72 ÷ tasa = años para duplicar`
- **Objetivo**: Comprensión del crecimiento exponencial
- **Métrica**: Sesgo < 100 puntos (números grandes)
- **Duración**: 35-45 minutos

---

## Metodología Científica

### Estructura Experimental Obligatoria

#### 1. Intervención Educativa
- **SUSTANCIA**: Herramientas prácticas específicas
- **NO retórica**: Eliminadas frases como "¡El ahorro es genial!"
- **Herramientas aplicables**: Fórmulas calculables inmediatamente

#### 2. Decisiones de Valuación
- **Tareas Pareadas**:
  * Problema COMPLEJO (requiere aplicar herramienta)
  * Problema TRANSPARENTE (equivalente pero obvio)
- **Práctica con Retroalimentación**: Inmediata y específica al error

#### 3. Evaluación
- **Tests específicos**: Al concepto enseñado, no alfabetización general
- **Medición de sesgo**: Pre/post intervención
- **Criterios objetivos**: Reducción de sesgo métrico

### Efectos Heterogéneos

Las lecciones están diseñadas para corregir sesgos en ambas direcciones:
- **Gastadores impulsivos** → Reducir sesgo positivo (sobrevaloración)
- **Ahorradores excesivos** → Reducir sesgo negativo (subvaloración)

---

## Uso del Framework

### Importación

```typescript
import {
  PairedTaskComponent,
  PracticalTool,
  CompetenceTracker,
  Lesson_Ages8to10_ValueComparison,
  Lesson_Ages11to13_BudgetingTool,
  Lesson_Ages14to16_CompoundInterest,
  LESSON_CATALOG,
  evaluateCompetence
} from './lessons_framework';
```

### Implementación Básica

```typescript
const MyFinancialLesson = ({ onComplete }) => {
  const [biasHistory, setBiasHistory] = useState([]);
  
  const handleTaskComplete = (complexAnswer, transparentAnswer, bias) => {
    setBiasHistory([...biasHistory, bias]);
    
    // Evaluar competencia
    const evaluation = evaluateCompetence(biasHistory, 0.5);
    console.log(evaluation); // { level, score, avgBias, recommendation }
  };

  return (
    <PairedTaskComponent
      task={myTask}
      onComplete={handleTaskComplete}
      showFeedback={true}
    />
  );
};
```

### Evaluación de Competencia

```typescript
import { evaluateCompetence, COMPETENCE_METRICS } from './lessons_framework';

const evaluation = evaluateCompetence(biasHistory, targetBias);
// Retorna: { level: 'expert'|'proficient'|'developing'|'novice', score, avgBias, recommendation }
```

---

## Criterios de Éxito

### Niveles de Competencia

| Nivel | Score | Descripción |
|-------|-------|-------------|
| **Novice** | 0-40 | Necesita más práctica con herramientas |
| **Developing** | 41-70 | Progreso sólido, sigue practicando |
| **Proficient** | 71-90 | Buena competencia deliberativa |
| **Expert** | 91-100 | Excelente competencia deliberativa |

### Métricas por Grupo de Edad

- **8-10 años**: Sesgo métrico < 1.0 punto
- **11-13 años**: Sesgo métrico < 0.5 puntos  
- **14-16 años**: Sesgo métrico < 100 puntos (para números grandes)

### Maestría de Herramientas

- ✅ 2+ tareas pareadas consecutivas exitosas
- ✅ 80%+ reducción de sesgo promedio
- ✅ 3+ aplicaciones correctas de herramienta específica

---

## Progresión Curricular

### Secuencia Recomendada

```
8-10 años:
├── Comparación de Valor (fundamento)
└── Planificación de Ahorros (aplicación)

11-13 años:  
├── Presupuestación 50/30/20 (gestión)
└── Gasto Inteligente (evaluación)

14-16 años:
└── Regla del 72 (inversión profesional)
```

---

## Diferencias con Educación Tradicional

### ❌ Educación Tradicional
- "¡El ahorro es importante!"
- Conocimiento general sobre finanzas
- Tests de alfabetización financiera
- Motivación y actitudes
- Medición de cambios conductuales

### ✅ Framework de Bernheim
- **Herramienta específica**: "72 ÷ tasa = años"
- **Competencia específica**: Aplicar Regla del 72
- **Test específico**: Tareas pareadas con la herramienta
- **Herramientas prácticas**: Calculables inmediatamente
- **Medición de sesgo métrico**: Diferencia complejo vs. simple

---

## Validación Científica

### Fundamento Teórico
- **Autor**: B. Douglas Bernheim (Stanford University)
- **Base**: Investigación en economía del comportamiento
- **Validación**: Efectos de bienestar reales vs. cambios superficiales

### Principios de Implementación

1. **NUNCA** usar retórica motivacional
2. **SIEMPRE** proveer herramientas calculables específicas  
3. **MEDIR** sesgo métrico monetario consistentemente
4. **DISEÑAR** para efectos heterogéneos
5. **EVALUAR** competencia deliberativa, no conocimiento general

---

## Archivos del Framework

```
lessons_framework/
├── README.md                              # Esta documentación
├── index.ts                              # Exportaciones y catálogo
├── BernheimFrameworkComponents.tsx       # Componentes base
├── Lesson_Ages8to10_ValueComparison.tsx  # Comparación de valor
├── Lesson_Ages8to10_SavingsGoals.tsx     # Planificación de ahorros  
├── Lesson_Ages11to13_BudgetingTool.tsx   # Herramienta 50/30/20
├── Lesson_Ages11to13_SmartSpending.tsx   # Gasto inteligente
└── Lesson_Ages14to16_CompoundInterest.tsx # Regla del 72
```

---

## Próximos Pasos

### Extensiones Posibles
- **Herramienta de Evaluación de Riesgo** (para 16+ años)
- **Calculadora de Costo de Oportunidad** (nivel avanzado)
- **Herramienta de Diversificación** (inversiones)

### Integración con Sistema
- Tracking de progreso individual
- Adaptación basada en sesgo inicial
- Recomendaciones personalizadas de herramientas

---

**Recuerda**: Este framework está diseñado para generar **efectos de bienestar reales**, no solo cambios conductuales superficiales. Cada herramienta debe ser aplicable inmediatamente y medida objetivamente a través del sesgo métrico monetario.