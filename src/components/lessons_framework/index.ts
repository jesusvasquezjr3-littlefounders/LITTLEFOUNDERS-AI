/**
 * FRAMEWORK DE COMPETENCIA DELIBERATIVA - B. DOUGLAS BERNHEIM
 * 
 * Este directorio implementa estrictamente el framework científico de Bernheim
 * para educación financiera, enfocándose en:
 * 
 * 1. COMPETENCIA DELIBERATIVA: Medir alineación entre decisiones complejas y simples
 * 2. HERRAMIENTAS PRÁCTICAS: Conceptos aplicables, no retórica motivacional  
 * 3. SESGO MÉTRICO MONETARIO: Diferencia entre valuaciones complejas vs transparentes
 * 4. EFECTOS HETEROGÉNEOS: Corrección de sesgos en ambas direcciones
 * 
 * Objetivo: Concentrar distribución de sesgos cerca de cero para efectos de bienestar reales.
 */

// Componentes base del framework
export { 
  PairedTaskComponent, 
  PracticalTool, 
  CompetenceTracker,
  characters
} from './BernheimFrameworkComponents';

// Tipos del framework
export type { PairedTask, BiasMetric, LessonProgress } from './BernheimFrameworkComponents';

// LECCIONES POR GRUPO DE EDAD

// Edades 8-10: Herramientas básicas con matemáticas simples
export { default as Lesson_Ages8to10_ValueComparison } from './Lesson_Ages8to10_ValueComparison';
export { default as Lesson_Ages8to10_SavingsGoals } from './Lesson_Ages8to10_SavingsGoals';

// Edades 11-13: Herramientas intermedias con porcentajes y planificación
export { default as Lesson_Ages11to13_BudgetingTool } from './Lesson_Ages11to13_BudgetingTool';
export { default as Lesson_Ages11to13_SmartSpending } from './Lesson_Ages11to13_SmartSpending';

// Edades 14-16: Herramientas avanzadas de nivel profesional
export { default as Lesson_Ages14to16_CompoundInterest } from './Lesson_Ages14to16_CompoundInterest';

// CATÁLOGO DE LECCIONES ORGANIZADAS POR COMPETENCIAS

export const LESSON_CATALOG = {
  // GRUPO 8-10 AÑOS: Conceptos fundamentales
  elementary: {
    ageRange: "8-10 años",
    description: "Herramientas básicas de comparación y planificación",
    lessons: [
      {
        id: "value_comparison_8_10",
        title: "Herramienta de Comparación de Valor",
        component: "Lesson_Ages8to10_ValueComparison",
        tool: "Cálculo de Valor por Unidad",
        formula: "Precio ÷ Cantidad = Valor por unidad",
        targetBias: 0.1,
        duration: "20-25 minutos",
        competencies: ["División básica", "Comparación de precios", "Decisiones de compra"]
      },
      {
        id: "savings_goals_8_10", 
        title: "Planificador de Metas de Ahorro",
        component: "Lesson_Ages8to10_SavingsGoals",
        tool: "Calculadora de Tiempo para Metas",
        formula: "(Meta - Ahorros actuales) ÷ Ahorro semanal = Semanas necesarias",
        targetBias: 1.0,
        duration: "20-25 minutos",
        competencies: ["Planificación temporal", "Motivación para ahorrar", "Metas realistas"]
      }
    ]
  },
  
  // GRUPO 11-13 AÑOS: Herramientas de gestión
  intermediate: {
    ageRange: "11-13 años",  
    description: "Herramientas de presupuestación y gastos inteligentes",
    lessons: [
      {
        id: "budgeting_tool_11_13",
        title: "Herramienta de Presupuestación 50/30/20",
        component: "Lesson_Ages11to13_BudgetingTool",
        tool: "Regla Presupuestaria 50/30/20",
        formula: "50% necesidades, 30% deseos, 20% ahorros",
        targetBias: 0.5,
        duration: "25-30 minutos",
        competencies: ["Categorización de gastos", "Porcentajes", "Disciplina financiera"]
      },
      {
        id: "smart_spending_11_13",
        title: "Herramienta de Gasto Inteligente", 
        component: "Lesson_Ages11to13_SmartSpending",
        tool: "Cálculo de Costo por Uso",
        formula: "Precio ÷ Veces que lo usarás = Costo real por uso",
        targetBias: 0.3,
        duration: "25-30 minutos",
        competencies: ["Evaluación de valor", "Decisiones racionales", "Uso esperado"]
      }
    ]
  },
  
  // GRUPO 14-16 AÑOS: Herramientas profesionales
  advanced: {
    ageRange: "14-16 años",
    description: "Herramientas de nivel profesional para inversión y crecimiento",
    lessons: [
      {
        id: "compound_interest_14_16",
        title: "La Regla del 72 - Interés Compuesto",
        component: "Lesson_Ages14to16_CompoundInterest", 
        tool: "La Regla del 72",
        formula: "72 ÷ tasa de interés = años para duplicar",
        targetBias: 100,
        duration: "35-45 minutos",
        competencies: ["Interés compuesto", "Planificación a largo plazo", "Evaluación de inversiones"]
      }
    ]
  }
};

// MÉTRICAS DE COMPETENCIA DELIBERATIVA
export const COMPETENCE_METRICS = {
  // Niveles de sesgo métrico por grupo de edad
  biasThresholds: {
    elementary: 1.0,    // Tolerancia mayor para edades 8-10
    intermediate: 0.5,  // Tolerancia media para edades 11-13  
    advanced: 100       // Tolerancia absoluta mayor para números grandes en 14-16
  },
  
  // Criterios de maestría de herramientas
  masteryRequirements: {
    consecutiveSuccess: 2,     // Tareas pareadas consecutivas exitosas
    biasReduction: 0.8,        // Reducción mínima de sesgo promedio
    toolApplication: 3         // Aplicaciones correctas mínimas de herramienta
  },
  
  // Interpretación de resultados
  competenceLevels: {
    novice: { min: 0, max: 40, description: "Necesita más práctica con herramientas" },
    developing: { min: 41, max: 70, description: "Progreso sólido, sigue practicando" }, 
    proficient: { min: 71, max: 90, description: "Buena competencia deliberativa" },
    expert: { min: 91, max: 100, description: "Excelente competencia deliberativa" }
  }
};

// UTILIDADES DE EVALUACIÓN
export const evaluateCompetence = (biasHistory: number[], targetBias: number) => {
  if (biasHistory.length === 0) return { level: 'novice', score: 0, recommendation: 'Completa algunas tareas pareadas' };
  
  const avgBias = biasHistory.reduce((sum, bias) => sum + Math.abs(bias), 0) / biasHistory.length;
  const biasReduction = Math.max(0, targetBias - avgBias);
  const reductionPercentage = (biasReduction / targetBias) * 100;
  
  const score = Math.min(100, Math.max(0, reductionPercentage));
  
  let level: keyof typeof COMPETENCE_METRICS.competenceLevels;
  if (score >= 91) level = 'expert';
  else if (score >= 71) level = 'proficient';
  else if (score >= 41) level = 'developing';
  else level = 'novice';
  
  const recommendations = {
    novice: 'Practica más con las herramientas básicas antes de problemas complejos',
    developing: 'Buen progreso. Enfócate en aplicar las herramientas consistentemente',
    proficient: 'Excelente competencia. Considera temas más avanzados',
    expert: 'Maestría completa. Listo para aplicar herramientas independientemente'
  };
  
  return {
    level,
    score: Math.round(score),
    avgBias: Math.round(avgBias * 100) / 100,
    recommendation: recommendations[level]
  };
};

// PROGRESIÓN CURRICULAR SUGERIDA
export const CURRICULUM_PROGRESSION = {
  "8-10 años": [
    "value_comparison_8_10",    // Fundamento: comparar opciones
    "savings_goals_8_10"        // Aplicación: planificar compras
  ],
  "11-13 años": [
    "budgeting_tool_11_13",     // Gestión: organizar dinero
    "smart_spending_11_13"      // Evaluación: decisiones inteligentes
  ],
  "14-16 años": [
    "compound_interest_14_16"   // Inversión: crecimiento a largo plazo
  ]
};

// RECURSOS ADICIONALES
export const FRAMEWORK_RESOURCES = {
  scientificBasis: {
    author: "B. Douglas Bernheim",
    paper: "On the Potential of Deliberative Competence-Based Financial Education",
    url: "https://www.youtube.com/watch?v=HK_djsf-_fM",
    keyFindings: [
      "Los programas tradicionales de educación financiera tienen efectos limitados",
      "La competencia deliberativa mide efectos de bienestar reales", 
      "Las herramientas específicas superan la educación general",
      "Los sesgos deben medirse y corregirse sistemáticamente"
    ]
  },
  
  implementationPrinciples: [
    "NUNCA usar retórica motivacional",
    "SIEMPRE proveer herramientas calculables específicas",
    "MEDIR sesgo métrico monetario consistentemente",
    "DISEÑAR para efectos heterogéneos (sesgos opuestos)",
    "EVALUAR competencia deliberativa, no conocimiento general"
  ]
};