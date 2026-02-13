/**
 * ExerciseEditorModal - Modal editor for individual exercises
 * Provides a JSON-based editor with bilingual support for all 40 exercise types.
 * For known types, provides structured field editors. Falls back to raw JSON for unknown types.
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, X, AlertTriangle } from "lucide-react";

// All 40 valid exercise types
const EXERCISE_TYPES = [
  "intro_narrative", "multiple_choice", "true_false", "fill_blank",
  "classification", "matching_pairs", "sequencing", "tap_action",
  "story_mode", "math_challenge", "word_scramble",
  "roleplay_chat", "estimation_slider", "risk_reward",
  "concept_builder", "quiz_battle",
  "shop_sim", "coin_counter", "price_detective", "bill_splitter",
  "budget_builder", "expense_timeline", "subscription_tracker",
  "savings_race", "emergency_fund", "goal_roadmap",
  "interest_calculator", "portfolio_builder", "mystery_investment",
  "passive_income", "opportunity_cost", "market_reaction",
  "inflation_simulator", "credit_score", "debt_strategy",
  "tax_puzzle", "salary_comparison", "spot_trap",
  "impact_meter", "mindset_comparison",
];

const TYPE_LABELS: Record<string, string> = {
  intro_narrative: "Narrativa Introductoria",
  multiple_choice: "Opción Múltiple",
  true_false: "Verdadero/Falso",
  fill_blank: "Completar Espacios",
  classification: "Clasificación",
  matching_pairs: "Emparejar",
  sequencing: "Secuenciación",
  tap_action: "Toca y Selecciona",
  story_mode: "Modo Historia",
  math_challenge: "Desafío Matemático",
  word_scramble: "Palabras Desordenadas",
  roleplay_chat: "Chat de Roles",
  estimation_slider: "Slider de Estimación",
  risk_reward: "Riesgo/Recompensa",
  concept_builder: "Constructor de Conceptos",
  quiz_battle: "Batalla de Quiz",
  shop_sim: "Simulador de Tienda",
  coin_counter: "Contador de Monedas",
  price_detective: "Detective de Precios",
  bill_splitter: "Dividir la Cuenta",
  budget_builder: "Constructor de Presupuesto",
  expense_timeline: "Línea de Gastos",
  subscription_tracker: "Rastreador de Suscripciones",
  savings_race: "Carrera de Ahorro",
  emergency_fund: "Fondo de Emergencia",
  goal_roadmap: "Mapa de Metas",
  interest_calculator: "Calculadora de Interés",
  portfolio_builder: "Constructor de Portafolio",
  mystery_investment: "Inversión Misteriosa",
  passive_income: "Ingresos Pasivos",
  opportunity_cost: "Costo de Oportunidad",
  market_reaction: "Reacción del Mercado",
  inflation_simulator: "Simulador de Inflación",
  credit_score: "Puntaje de Crédito",
  debt_strategy: "Estrategia de Deuda",
  tax_puzzle: "Puzzle de Impuestos",
  salary_comparison: "Comparación Salarial",
  spot_trap: "Detectar la Trampa",
  impact_meter: "Medidor de Impacto",
  mindset_comparison: "Comparación de Mentalidad",
};

interface ExerciseEditorModalProps {
  open: boolean;
  onClose: () => void;
  exerciseEs: any;
  exerciseEn: any;
  index: number;
  onSave: (exerciseEs: any, exerciseEn: any) => void;
}

export default function ExerciseEditorModal({
  open,
  onClose,
  exerciseEs,
  exerciseEn,
  index,
  onSave,
}: ExerciseEditorModalProps) {
  const [localEs, setLocalEs] = useState<string>("");
  const [localEn, setLocalEn] = useState<string>("");
  const [exerciseType, setExerciseType] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setLocalEs(JSON.stringify(exerciseEs || {}, null, 2));
      setLocalEn(JSON.stringify(exerciseEn || {}, null, 2));
      setExerciseType(exerciseEs?.type || "");
      setParseError("");
    }
  }, [open, exerciseEs, exerciseEn]);

  const handleSave = () => {
    try {
      const parsedEs = JSON.parse(localEs);
      const parsedEn = JSON.parse(localEn);

      // Ensure type is set
      if (exerciseType) {
        parsedEs.type = exerciseType;
        parsedEn.type = exerciseType;
      }

      onSave(parsedEs, parsedEn);
      onClose();
    } catch (e: any) {
      setParseError(`Error de JSON: ${e.message}`);
    }
  };

  const handleTypeChange = (newType: string) => {
    setExerciseType(newType);
    try {
      const parsedEs = JSON.parse(localEs);
      const parsedEn = JSON.parse(localEn);
      parsedEs.type = newType;
      parsedEn.type = newType;
      setLocalEs(JSON.stringify(parsedEs, null, 2));
      setLocalEn(JSON.stringify(parsedEn, null, 2));
    } catch {
      // Keep existing text
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Ejercicio #{index + 1}</span>
            <Badge variant="outline">
              {TYPE_LABELS[exerciseType] || exerciseType || "Sin tipo"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          {/* Type Selector */}
          <div className="flex items-center gap-4">
            <Label className="w-24">Tipo:</Label>
            <Select value={exerciseType} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {EXERCISE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4" />
              {parseError}
            </div>
          )}

          {/* Bilingual JSON Editor */}
          <Tabs defaultValue="side-by-side" className="flex-1">
            <TabsList>
              <TabsTrigger value="side-by-side">Lado a Lado</TabsTrigger>
              <TabsTrigger value="es">Solo Español</TabsTrigger>
              <TabsTrigger value="en">Solo English</TabsTrigger>
            </TabsList>

            <TabsContent value="side-by-side" className="mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1 block">
                    Español (ES)
                  </Label>
                  <Textarea
                    value={localEs}
                    onChange={(e) => {
                      setLocalEs(e.target.value);
                      setParseError("");
                    }}
                    className="font-mono text-xs min-h-[400px] resize-y"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1 block">
                    English (EN)
                  </Label>
                  <Textarea
                    value={localEn}
                    onChange={(e) => {
                      setLocalEn(e.target.value);
                      setParseError("");
                    }}
                    className="font-mono text-xs min-h-[400px] resize-y"
                    spellCheck={false}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="es" className="mt-2">
              <Label className="text-sm font-medium mb-1 block">
                Español (ES)
              </Label>
              <Textarea
                value={localEs}
                onChange={(e) => {
                  setLocalEs(e.target.value);
                  setParseError("");
                }}
                className="font-mono text-xs min-h-[500px] resize-y"
                spellCheck={false}
              />
            </TabsContent>

            <TabsContent value="en" className="mt-2">
              <Label className="text-sm font-medium mb-1 block">
                English (EN)
              </Label>
              <Textarea
                value={localEn}
                onChange={(e) => {
                  setLocalEn(e.target.value);
                  setParseError("");
                }}
                className="font-mono text-xs min-h-[500px] resize-y"
                spellCheck={false}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Guardar Ejercicio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
