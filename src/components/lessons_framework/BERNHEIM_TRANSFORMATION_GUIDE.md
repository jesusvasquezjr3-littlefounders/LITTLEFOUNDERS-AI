# Guía de Transformación al Framework de Bernheim

## Resumen del Proyecto Completado

### ✅ Lecciones Transformadas (5/24)

1. **Lesson1_1_WhatIsMoney_Bernheim.tsx** - Calculadora de Equivalencia Monetaria
2. **Lesson2_3_Saving_Bernheim.tsx** - Calculadora de Ahorro Temporal  
3. **Lesson1_1_WhatIsBudget_Bernheim.tsx** - Calculadora de Distribución Presupuestaria
4. **Lesson1_3_NeedsVsWants_Bernheim.tsx** - Calculadora de Priorización de Gastos
5. **Lesson3_1_PriceQualityComparison_Bernheim.tsx** - Calculadora de Valor por Uso

### 📋 Lecciones Pendientes (19/24)

**Nivel Básico (Edades 8-12):**
- Lesson1_2_WhereMoneyComesFrom.tsx → Calculadora de Fuentes de Ingresos
- Lesson1_2_ExpenseTracking.tsx → Herramienta de Seguimiento de Gastos
- Lesson2_1_WhatIsBank.tsx → Calculadora de Servicios Bancarios
- Lesson2_2_SavingsAccounts.tsx → Comparador de Cuentas de Ahorro
- Lesson2_4_MyFirstSavingGoals.tsx → Planificador de Metas de Ahorro

**Nivel Intermedio (Edades 10-14):**
- Lesson2_1_TasksAndAllowance.tsx → Calculadora de Ingresos por Tareas
- Lesson2_2_SmartPurchaseDecisions.tsx → Matriz de Decisión de Compra
- Lesson3_2_OffersAndDiscounts.tsx → Calculadora de Descuentos Reales

**Nivel Avanzado (Edades 13-16):**
- Lesson4_1_PlanificacionFinanciera.tsx → Herramienta de Planificación Financiera
- Lesson4_2_IngresosTrabajos.tsx → Calculadora de Ingresos Laborales
- Lesson5_1_QueEsCredito.tsx → Calculadora de Costo de Crédito
- Lesson5_2_HistorialCrediticio.tsx → Simulador de Historial Crediticio
- Lesson6_1_QueSonInversiones.tsx → Calculadora de Retorno de Inversión
- Lesson6_2_RiesgoRendimiento.tsx → Evaluador de Riesgo-Rendimiento
- Lesson7_1_CostosVidaIndependiente.tsx → Calculadora de Costos de Vida
- Lesson7_2_SegurosProteccion.tsx → Calculadora de Seguros Necesarios

## Framework de Bernheim - Estructura Obligatoria

### 1. ESTRUCTURA DE ARCHIVOS

```typescript
// Importaciones requeridas
import React, { useState } from 'react';
import { PairedTaskComponent, PracticalTool, CompetenceTracker, ... } from './BernheimFrameworkComponents';

// Estados obligatorios
const [currentStage, setCurrentStage] = useState<'intervention' | 'valuation' | 'evaluation'>('intervention');
const [biasHistory, setBiasHistory] = useState<number[]>([]);
const [currentBias, setCurrentBias] = useState<number>(0);
const [lessonProgress, setLessonProgress] = useState<LessonProgress>({...});
```

### 2. ETAPAS OBLIGATORIAS

#### **ETAPA 1: INTERVENCIÓN EDUCATIVA (SUSTANCIA)**
- ❌ SIN retórica motivacional
- ✅ CON herramienta práctica calculable
- ✅ CON ejemplos específicos con números
- ✅ CON fórmulas matemáticas claras

```typescript
// Ejemplo de herramienta práctica
const practicalTool = (
  <Card>
    <CardHeader>Herramienta: [Nombre Específico]</CardHeader>
    <CardContent>
      <ol>Pasos sistemáticos numerados</ol>
      <CalculadoraInteractiva />
      <div>Fórmula matemática</div>
    </CardContent>
  </Card>
);
```

#### **ETAPA 2: DECISIONES DE VALUACIÓN (TAREAS PAREADAS)**
- ✅ Problema COMPLEJO: Requiere aplicar la herramienta
- ✅ Problema TRANSPARENTE: Equivalente pero obvio
- ✅ Ambos problemas deben tener la MISMA respuesta correcta
- ✅ Incluir segunda tarea para efectos heterogéneos

```typescript
const pairedTask: PairedTask = {
  complexProblem: {
    question: "Problema que requiere usar la herramienta...",
    correctAnswer: 42, // Número específico
    explanation: "Explicación con cálculo paso a paso"
  },
  transparentProblem: {
    question: "Versión simple del mismo problema...",
    correctAnswer: 42, // MISMO número
    explanation: "Explicación directa"
  }
};
```

#### **ETAPA 3: EVALUACIÓN (COMPETENCIA DELIBERATIVA)**
- ✅ Medición de sesgo métrico = diferencia entre respuestas
- ✅ Interpretación personalizada del sesgo
- ✅ Consejos para efectos heterogéneos
- ✅ Criterios específicos de competencia

### 3. MÉTRICAS DE COMPETENCIA POR TEMA

| Tema | Sesgo Máximo para Competencia | Unidad |
|------|------------------------------|--------|
| Valuación Monetaria | ≤ $5 | Dólares |
| Ahorro Temporal | ≤ 3 meses | Meses |
| Distribución Presupuestaria | ≤ $5 | Dólares |
| Priorización de Gastos | ≤ $4 | Dólares |
| Valor por Uso | ≤ $0.50 | Dólares/mes |

### 4. EFECTOS HETEROGÉNEOS REQUERIDOS

Cada lección debe incluir al menos dos tareas pareadas que aborden:
- **Gastadores impulsivos**: Reducir sesgo hacia sobrevaloración
- **Ahorradores excesivos**: Reducir sesgo hacia subvaloración
- **Conservadores**: Balancear con decisiones prácticas
- **Optimistas**: Incluir consideraciones realistas

### 5. COMPONENTES INTERACTIVOS OBLIGATORIOS

Cada lección debe incluir:
- ✅ Calculadora práctica específica al tema
- ✅ Ejemplos numéricos concretos (mínimo 3)
- ✅ Fórmulas matemáticas aplicables
- ✅ Retroalimentación inmediata
- ✅ Seguimiento de progreso

## Template para Nuevas Transformaciones

### Paso 1: Identificar Concepto Sustantivo
```
❌ Concepto vago: "Aprender sobre crédito"
✅ Herramienta específica: "Calculadora de Costo Real de Crédito"
```

### Paso 2: Crear Fórmula Matemática
```
Ejemplo: Costo Real = Principal × (1 + Tasa)^Tiempo - Principal
```

### Paso 3: Diseñar Tareas Pareadas
```
Complejo: "Juan pide $1000 prestados al 15% anual por 2 años con pagos mensuales. ¿Cuánto pagará en total?"
Transparente: "Si el costo total de un préstamo es $1323, ¿cuánto es el costo total?"
```

### Paso 4: Definir Competencia
```
Sesgo métrico: Diferencia entre cálculo complejo vs. simple
Competencia: |sesgo| ≤ $20 para crédito
```

### Paso 5: Efectos Heterogéneos
```
Conservador: Tiende a subestimar costos → Usar herramienta sistemática
Optimista: Tiende a subestimar riesgos → Incluir escenarios realistas
```

## Instrucciones para Completar las 19 Lecciones Restantes

### Prioridad Alta (Completar primero):
1. **Lesson2_2_SmartPurchaseDecisions.tsx** → Matriz de Decisión de Compra
2. **Lesson4_1_PlanificacionFinanciera.tsx** → Herramienta de Planificación Financiera
3. **Lesson5_1_QueEsCredito.tsx** → Calculadora de Costo de Crédito

### Prioridad Media:
- Todas las lecciones de nivel básico e intermedio

### Prioridad Baja:
- Lecciones de nivel avanzado (pueden requerir ajustes de edad)

## Validación Final

Cada lección transformada debe cumplir:
- [ ] 3 etapas obligatorias implementadas
- [ ] Herramienta práctica con fórmula matemática
- [ ] 2+ tareas pareadas con misma respuesta correcta
- [ ] Medición de sesgo métrico específico al tema
- [ ] Efectos heterogéneos considerados
- [ ] Sin retórica motivacional
- [ ] Componentes interactivos funcionando
- [ ] Criterios de competencia definidos

## Recursos Disponibles

### Componentes Reutilizables:
- `PairedTaskComponent`: Para tareas pareadas
- `PracticalTool`: Para herramientas prácticas
- `CompetenceTracker`: Para seguimiento de progreso
- `BernheimFrameworkComponents`: Componentes base

### Patrones Establecidos:
- Ver lecciones ya transformadas como referencia
- Usar métricas específicas por tema
- Seguir estructura de 3 etapas
- Incluir calculadoras interactivas

---

**Estado del Proyecto:** 5/24 lecciones completadas (21% completo)
**Próximo paso:** Completar Lesson2_2_SmartPurchaseDecisions.tsx
**Tiempo estimado para completar:** 15-20 horas adicionales
