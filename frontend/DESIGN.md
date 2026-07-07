---
name: Corporativo Island
colors:
  primary: "#4f46e5"
  primary-light: "#818cf8"
  primary-dark: "#a5b4fc"
  secondary: "#334155"
  secondary-light: "#64748b"
  secondary-dark: "#94a3b8"
  neutral:
    page-light: "#f8fafc"
    page-dark: "#0a0e1a"
    surface-light: "#ffffff"
    surface-dark: "#0d1426"
    border-light: "rgba(15, 23, 42, 0.08)"
    border-dark: "rgba(255, 255, 255, 0.08)"
  brand-gradient: "#4f46e5 → #2563eb"
  brand-gradient-text: "#4f46e5 → #2563eb → #0ea5e9"
  semantic:
    success: "#10b981"
    warning: "#f59e0b"
    danger: "#e11d48"
    info: "#3b82f6"
  text:
    heading-light: "#0f172a"
    heading-dark: "#ffffff"
    body-light: "#475569"
    body-dark: "#cbd5e1"
    muted-light: "#64748b"
    muted-dark: "#94a3b8"
    brand-light: "#4f46e5"
    brand-dark: "#a5b4fc"
  dark-hex:
    section-white: "#070b14"
    section-slate: "#0a0e1a"
    footer: "#060911"
    floating: "#0d1426"
    divider: "#0f1628"
typography:
  body:
    fontFamily: Inter
    fontWeight: 400
  heading:
    fontFamily: Sora
    fontWeight: 700
    letterSpacing: "-0.02em"
    textWrap: balance
  scale-classes:
    headings: "corp-h1 | corp-h2 | corp-h3 | corp-h4"
    subtitles: "corp-subtitle-lg | corp-subtitle | corp-subtitle-sm"
    body: "corp-body-lg | corp-body | corp-body-sm | corp-caption"
    numbers: "corp-number | corp-number-lg"
    special: "corp-eyebrow | corp-display | corp-gradient-text | corp-label"
  eyebrow:
    class: corp-eyebrow
    fontFamily: Inter
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.14em"
    textTransform: uppercase
    color: "#4f46e5"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace"
  display:
    fontFamily: Sora
    fontWeight: 700
    letterSpacing: "-0.02em"
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  island: "2.5rem"
  full: "9999px"
motion:
  feedback: "120ms"
  content: "250ms"
  easing: "cubic-bezier(0.2, 0, 0, 1)"
  scale-press: "0.96"
  icon-spring:
    type: spring
    duration: "0.3s"
    bounce: 0
  stagger-delay: "100ms"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section-py: "6rem"
  container-max: "80rem"
  hero-pt: "11rem"
components:
  corp-card:
    backgroundColor: "{colors.neutral.surface-light}"
    borderColor: "{colors.neutral.border-light}"
    rounded: "{rounded.xl}"
  corp-panel:
    backgroundColor: "{colors.neutral.surface-light}"
    borderColor: "{colors.neutral.border-light}"
    rounded: "{rounded.xl}"
  corp-panel-subtle:
    backgroundColor: "#f8fafc"
    borderColor: "rgba(15, 23, 42, 0.06)"
    rounded: "{rounded.lg}"
  corp-dialog:
    backgroundColor: "{colors.neutral.surface-light}"
    borderColor: "{colors.neutral.border-light}"
  corp-btn-primary:
    backgroundColor: "linear-gradient({colors.brand-gradient})"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
  corp-btn-secondary:
    backgroundColor: "{colors.neutral.surface-light}"
    textColor: "{colors.secondary}"
    borderColor: "rgba(15, 23, 42, 0.12)"
  corp-btn-ghost:
    backgroundColor: "transparent"
    textColor: "#475569"
  corp-btn-danger:
    backgroundColor: "linear-gradient(120deg, #e11d48, #dc2626)"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
  corp-input:
    backgroundColor: "#f8fafc"
    textColor: "#0f172a"
    borderColor: "rgba(15, 23, 42, 0.10)"
    rounded: "{rounded.md}"
  corp-badge:
    backgroundColor: "#f1f5f9"
    textColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    fontSize: "0.72rem"
  corp-table:
    fontSize: "0.875rem"
  corp-icon-chip:
    backgroundColor: "#eef2ff"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
  corp-empty:
    textColor: "{colors.text.muted-light}"
  corp-eyebrow:
    typography: "{typography.eyebrow}"
---

# DESIGN.md — Estándar Visual "Corp" (Director de Frontend)

> **Última actualización:** 2026-07-06
> **Autoridad:** Documento **Director** del Frontend. Estándar visual
> **inmutable** para toda vista de "chrome serio". Es subordinado a
> `CLAUDE.md` y `AGENTS.md`, pero **autoritativo** sobre cualquier estilo
> ad-hoc de página o componente.
> **Definiciones CSS:** `frontend/src/index.css` (secciones
> `CORPORATE MARKETING SYSTEM` + `CORP SYSTEM — APP / ADMIN PRIMITIVES`).
> **Configuración Tailwind:** `frontend/tailwind.config.ts`.

---

## 0. Checklist Pre-Vuelo del Agente

Antes de escribir **CUALQUIER** código de frontend, todo agente DEBE
auto-verificar esta lista. Si un ítem no se cumple, el código está
**incompleto** y será rechazado en revisión.

### Design System
- [ ] He leído `DESIGN.md` completo y entiendo el estándar visual Corp
- [ ] Usaré clases `corp-*` para todas las superficies de chrome
- [ ] NO usaré `liquid-glass`, `GlassPanel`, ni colores hex arbitrarios

### Tipografía
- [ ] Todos los textos usan clases `corp-*` tipográficas (nada de `text-sm font-semibold text-slate-600` ad-hoc)
- [ ] `text-balance` ya está incluido en `corp-h1`–`corp-h4` — no aplicar manualmente
- [ ] `text-pretty` ya está incluido en `corp-subtitle-*` y `corp-body-*` — no aplicar manualmente
- [ ] `tabular-nums` ya está incluido en `corp-number` y `corp-number-lg` — no aplicar manualmente
- [ ] El `<html>` root tiene `antialiased`

### Superficies
- [ ] Los elementos redondeados anidados siguen radio de borde concéntrico
- [ ] Los elementos interactivos tienen área de toque ≥44×44px
- [ ] Las imágenes usan solo bordes redondeados — sin marcos, outlines ni bordes

### Animación
- [ ] Las animaciones usan Framer Motion o CSS transitions — **nunca keyframes para elementos interactivos**
- [ ] Scale on press = `active:scale-[0.96]` **solamente** — nunca < 0.95
- [ ] **Sin `transition: all`** — siempre se especifican propiedades exactas
- [ ] `prefers-reduced-motion` está respetado en todas las animaciones
- [ ] `will-change` solo en `transform`/`opacity`/`filter` — nunca `all`

### General
- [ ] Todo texto visible usa `t()` de i18n
- [ ] Mobile-first: clases base para móvil, breakpoints `sm:`/`lg:` para desktop
- [ ] Íconos exclusivamente de `lucide-react`
- [ ] Todo color con su par `dark:` (excepto clases `corp-*` que ya lo incluyen)

---

## TL;DR para agentes

1. **No inventes estilos.** Usa las clases `corp-*` documentadas aquí.
2. **Prohibido en vistas corp:** el look lúdico viejo — gradientes
   `blue→purple→pink`, acentos dominados por `pink`/`rose`, "arcoíris" por-ítem,
   blobs "ambient glow" apilados, micro-labels `font-black uppercase tracking-widest`,
   radios one-off (`rounded-[2rem]`). (Acentos `violet`/`fuchsia` mesurados SÍ — §4.1.)
3. **Todo color lleva su par `dark:`** (excepto las clases `corp-*`, que ya
   traen su variante `.dark` interna — no les agregues `dark:`).
4. **i18n obligatorio** (`t()`), **mobile-first** (base = móvil), **sin `any`**.
5. **No corrompas la lógica:** handlers, estado, fetch, rutas, `id` (anclas /
   tours / tests), props y claves `t()` se preservan **byte por byte**.
6. **Usa las skills de diseño** al crear/modificar UI (ver catálogo en `CLAUDE.md` §4):
   - `agave` — instintos de senior product designer antes de generar código UI.
   - `emil-design-eng` — filosofía de motion/animaciones (escribir) + `review-animations` (revisar).
   - `impeccable` — rediseños, auditorías, pulido con subcomandos (`craft`, `shape`, `audit`, `polish`, `animate`, etc.).
   - Las skills **complementan** este design system, no lo reemplazan.

---

## 1. Filosofía y Alcance

### 1.0 Referencia estética

El lenguaje **Corp** evoca la estética editorial de un **dashboard financiero institucional
con la moderación tipográfica de Notion** — superficies blancas como islas flotando
sobre un mar slate-50 silencioso, tipografía editorial sobria, y un solo acento
de color (índigo→azul) que guía la mirada. No es "enterprise genérico": es la
confianza visual de una fintech que habla a padres e instituciones, combinada con
la legibilidad diáfana de una herramienta de productividad moderna.

### 1.1 Los dos lenguajes visuales

LittleFounders tiene **dos lenguajes visuales** deliberados:

| Lenguaje | Para quién / dónde | Tipografía | Identidad |
|----------|--------------------|-----------|-----------|
| **Corp** (este doc) | "Chrome serio": marketing, auth, cuenta, dashboards, **admin**, utilitarias, perfil social, landing pages | Inter (texto) + Sora (títulos) | Fintech editorial + Notion: limpio, confiable, slate + índigo |
| **Playful** (§9) | Experiencia inmersiva de niños: juegos `/games/*`, motor de lecciones inmersivo, celebraciones | Nunito | Lúdico, colorido, gamificado |

> El scope `.corp` aplica la tipografía Inter+Sora a todo el árbol,
> lúdico y meterlo al sistema Inter/Sora profesional.

### 1.1 ¿Qué vistas son "Corp"? (alcance inmutable)

**SÍ corp** (deben cumplir este estándar):

- **Marketing:** `LandingPage`, `landing/FamiliesPage`, `landing/HowItWorksPage`,
  `landing/PricingPage`, `landing/FaqPage` + `LandingLayout` / `LandingNavbar` /
  `LandingFooter`. *(Ya migradas — son la referencia.)*
- **Auth / onboarding:** `Login`, `Signup`, `Onboarding`, `PlacementPage`
  (+ `features/placement/*`), `ForgotPassword`, `ResetPassword`, `AuthCallback`,
  `Bye`.
- **Cuenta** (dentro de `DashboardLayout`): `Profile`, `Settings`,
  `Help`, `AvatarEditor`, `dashboard/ParentDashboard`.
- **Shell de la app** (compartido): `dashboard/DashboardLayout`,
  `dashboard/Sidebar`, `dashboard/TopNav`. El root de `DashboardLayout` lleva
  `.corp` y una superficie limpia (`bg-slate-50 dark:bg-[#070b14]`); se eliminó
  el `AnimatedBackground` lúdico.
- **Navegación de aprendizaje** (no es gameplay): `LearnPage`, `GamesPage`
  (catálogo), y los componentes de ruta `lessons/Adventures`,
  `lessons/AdventureCard`, `lessons/SagaView`.
- **Admin** (shell propio): `admin/AdminLayout`, `admin/AdminSidebar` + **todas**
  las páginas `admin/*` + componentes admin (`admin/ExercisePreview`).
- **Utilitarias / social:** `NotFound`, `PageUnderConstruction`,
  `social/UserProfile`.
- **Compartidos:** `avatar/AvatarDisplay`, cualquier `Dialog` (vía `corp-dialog`),
  `ReportModal`, y los primitivos shadcn (`ui/*`) — sus superficies `liquid-glass`
  ahora renderizan como corp (ver §5.1).

**NO corp** (lenguaje Playful, §9 — **único** territorio exento):

- Juegos `frontend/src/games/*` (canvas + `game-fullscreen`, gameplay real).
- Motor de lecciones inmersivo `components/lessons/engine/*` (`LessonRunner`).
- Momentos de celebración (`ui/StreakCelebration`, confetti) — delight efímero.

> Todo lo demás es **Corp**. La identidad lúdica vive **dentro del gameplay**, no
> en la navegación ni el chrome.

### 1.2 La regla del scope

- El **shell de la app** (`DashboardLayout`) ya lleva `.corp` en su root, así que
  **toda** página autenticada hereda Inter/Sora + superficies corp
  automáticamente. No necesitas re-agregar `.corp` en páginas dentro del shell
  (es inofensivo si ya lo tienen).
- **Admin** y **auth** tienen shells no compartidos: el `.corp` va en el root del
  shell (`AdminLayout`) o en el root standalone de la página de auth.
- El **motor de lecciones** y los **juegos** se renderizan en rutas propias
  (`/lesson/:code`, `/games/*`) FUERA de `DashboardLayout`, por eso conservan su
  identidad lúdica sin esfuerzo extra.

---

## 2. Cómo aplicar el scope `.corp`

`.corp` (definido en `index.css`) fuerza `font-family: Inter` en
`button/input/select/textarea/span/p/li/a` y `Sora` en `h1–h6` + `.corp-display`
(con `!important`). Tres formas de adoptarlo:

| Caso | Cómo |
|------|------|
| **Página de marketing** | Envolver en `<LandingLayout>` (su root ya trae `.corp`). No agregues `.corp` tú. |
| **Página standalone** (auth, error, splash) | El root es el shell de §3.B con `className="corp ..."`. |
| **Página dentro de un shell lúdico** (cuenta) | `className="corp"` en el wrapper de contenido (§1.2). |
| **Página admin** | `.corp` en el root de `AdminLayout` (cubre todo `/admin/*`). |
| **Modal (Radix Dialog)** | El portal sale del árbol: aplica `corp-dialog` directo al `DialogContent` (§5.5). |

> `font-mono` se preserva dentro de `.corp` (regla dedicada en `index.css`):
> usa `font-mono` normal para códigos / IDs / usernames.

---

## 3. Roots canónicos

### A) Página de marketing (vía LandingLayout)

```tsx
return (
  <LandingLayout>           {/* root .corp + Navbar + Footer */}
    <header className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20">
        <div className="bg-white dark:bg-[#0d1426] rounded-[2.5rem] p-8 sm:p-12 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-white/5">
          …
        </div>
      </div>
    </header>
    {/* secciones alternando bg-white / bg-slate-50 */}
  </LandingLayout>
);
```

### B) Página standalone full-screen (auth / error / splash)

```tsx
<div className="corp min-h-screen relative overflow-hidden bg-slate-50 dark:bg-[#0a0e1a]">
  <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-[#0d1426] rounded-[2.5rem] w-full p-8 sm:p-10 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-white/5 space-y-6">…</div>
    </div>
  </div>
</div>
```

### C) Contenido dentro de un shell (cuenta)

```tsx
<DashboardLayout>
  <div className="corp max-w-6xl mx-auto px-4 py-8 space-y-6">…</div>
</DashboardLayout>
```

**Fondo corp canónico** (Estilo Brilliant/Island): Fondo sólido `bg-slate-50 dark:bg-[#0a0e1a]`, sin cuadrículas ni glows.

---

## 4. Tokens

### 4.1 Color (paleta)

Cada color del sistema corp existe por una razón funcional, no decorativa.
No se añaden colores nuevos sin justificar su rol en la interfaz.

#### 4.1.1 Neutros — Chrome y superficies (`slate`)

- `slate-50` (`#f8fafc`) → **Fondo de página.** Un gris casi blanco que crea
  un "mar silencioso" donde flotan las islas blancas. Menos agresivo que el
  blanco puro de fondo, evita el "flash blanco" en transiciones.
- `slate-100` … `slate-200` → **Bordes y separadores sutiles.** Líneas que
  dividen sin competir con el contenido.
- `slate-400` … `slate-500` → **Texto muted y metadata.** Información
  secundaria que debe estar presente pero no dominar.
- `slate-600` → **Texto body.** Lectura cómoda sobre fondo blanco; contraste
  suficiente sin ser negro puro (que fatiga).
- `slate-900` → **Títulos y headings.** Máximo contraste para jerarquía.

> **Por qué slate y no gray/neutral:** slate tiene un matiz azul frío que
> armoniza con el acento índigo de marca. `gray` y `neutral` son cromáticamente
> planos y no dialogan con el gradiente índigo→azul.

#### 4.1.2 Marca — Acento del sistema (`indigo` / `blue` / `sky`)

- `#4f46e5` (indigo-600) → **Color de marca.** Botones primarios, enlaces,
  íconos activos, foco de inputs, indicador de progreso, chip de ícono.
- `#2563eb` (blue-600) → **Segundo punto del gradiente.** Da calidez al
  gradiente evitando que el índigo solo se sienta frío o corporativo distante.
- `#0ea5e9` (sky-500) → **Tercer punto (solo en `corp-gradient-text`).**
  Reservado para UNA palabra o cifra enfatizada por vista.
- `gradiente de marca` → `from-indigo-500 to-blue-500`. **Por qué gradiente
  y no sólido:** un botón sólido índigo se siente "formulario gubernamental";
  el gradiente añade profundidad y una sensación de producto digital
  contemporáneo sin caer en lo lúdico.

#### 4.1.3 Acentos categóricos — Diferenciación controlada

Para diferenciar features/categorías en cards de marketing y dashboards se
admite un set acotado. **Úsalos con mesura** — no todos en la misma vista:

| Color | Cuándo usarlo | Ejemplo |
|-------|--------------|---------|
| `violet`/`fuchsia` | Pilares de producto en landing, secciones "cómo funciona" | `from-violet-500 to-fuchsia-500` |
| `emerald`/`teal` | Éxito, seguridad, completado | Badge `--success`, chip de verificación |
| `sky`/`cyan` | Información, ayuda, tooltips | Badge `--info` |
| `amber` | Estrellas, monedas, recompensas | Contador de puntos, rating |

> Cada acento lleva su par `dark:` equivalente.

#### 4.1.4 Semánticos — Estados del sistema

| Color | Significado | Uso típico |
|-------|------------|-----------|
| `emerald`/`teal` | Éxito, completado, seguro | `corp-badge--success`, toast de confirmación |
| `amber` | Advertencia, atención, moneda | `corp-badge--warning`, contador de créditos |
| `red`/`rose` | Peligro, error, destructivo | `corp-badge--danger`, `corp-btn-danger`, `corp-input--error` |
| `blue`/`sky` | Informativo, neutral | `corp-badge--info`, tooltip |

#### 4.1.5 Prohibido — Anti-patrones de color

- Gradientes multi-stop tipo `blue→purple→pink` (look lúdico viejo).
- Acentos **dominados por `pink`/`rose` decorativo** — el rosa de la marca
  infantil anterior NO pertenece al lenguaje corp.
- Sistemas de color "arcoíris" por-ítem (cada fila/opción de un color
  distinto) — rompen la jerarquía y fatigan.
- Colores sin su par `dark:` en código nuevo.

#### 4.1.6 Hex dark — Valores de fondo en modo oscuro

Estos hex crudos se usan en las clases `corp-*` (que ya incluyen su `.dark`
interna). Para utilidades Tailwind en páginas, úsalos tal cual:

| Rol | Light | Dark |
|-----|-------|------|
| Sección blanca | `bg-white` | `dark:bg-[#070b14]` |
| Sección slate-50 | `bg-slate-50` | `dark:bg-[#0a0e1a]` |
| Footer profundo | — | `dark:bg-[#060911]` |
| Superficie flotante/chip | — | `dark:bg-[#0d1426]` |
| Pill divisor "o" | — | `dark:bg-[#0f1628]` |

### 4.2 Tipografía — Escala y contexto de uso

El sistema tipográfico corp usa **dos typefaces** con roles fijos e inamovibles:

| Typeface | Rol | Dónde se aplica | Por qué |
|----------|-----|----------------|---------|
| **Inter** | Texto de lectura (body, UI) | `body`, `p`, `span`, `button`, `input`, `label`, `li`, `a` | Legibilidad superior en tamaños pequeños; diseñada para interfaces. Sus formas abiertas y espaciado generoso la hacen la opción canónica para texto corrido en pantalla. |
| **Sora** | Display / headings | `h1`–`h6`, `.corp-display` | Personalidad sin perder seriedad. Sus trazos geométricos y terminales limpias evocan una fintech moderna — no es una serif corporativa rígida ni una sans-serif genérica. El `letter-spacing: -0.02em` compacta los títulos sin sacrificar legibilidad. |

> **Regla de scope:** `.corp` aplica Inter a todo el texto de UI y Sora a
> headings con `!important`. `font-mono` se preserva explícitamente dentro de
> `.corp` (ver `index.css` §`CORP SYSTEM`).

#### Escala tipográfica centralizada — Catálogo completo de clases

Todas las clases están definidas en `frontend/src/index.css` §`CORP TYPOGRAPHIC SCALE` (línea ~2396).
Cada clase incluye su variante `.dark` automática. **Queda prohibido componer tamaños ad-hoc con
utilidades Tailwind.** Ver §4.2.5 para la regla de oro.

| Clase | Elemento | Base | `sm:` | `lg:` | Peso | Color (light) | Usar para |
|-------|----------|------|-------|-------|------|---------------|-----------|
| `corp-h1` | Hero heading | `2rem` | `2.5rem` | `3rem` | 700 | `#0f172a` | Hero de página. Una vez por vista de marketing. |
| `corp-h2` | Section heading | `1.5rem` | `1.75rem` | `2rem` | 700 | `#0f172a` | Título de sección. Siempre con `corp-eyebrow` arriba. |
| `corp-h3` | Card / panel title | `1.125rem` | `1.25rem` | `1.5rem` | 700 | `#0f172a` | Título dentro de `corp-card`, panel o diálogo. |
| `corp-h4` | Sub-section heading | `1rem` | `1.125rem` | `1.25rem` | 700 | `#0f172a` | Sub-título secundario, encabezado de sub-sección. |
| `corp-subtitle-lg` | Large subtitle | `1rem` | `1.125rem` | `1.25rem` | 500 | `#475569` | Bajo hero o H2. Texto introductorio de sección. |
| `corp-subtitle` | Default subtitle | `0.875rem` | `1rem` | `1.125rem` | 500 | `#475569` | Bajo título de card o intro de sección. |
| `corp-subtitle-sm` | Small subtitle | `0.75rem` | `0.875rem` | `1rem` | 500 | `#64748b` | Metadata, descripción bajo un título de card. |
| `corp-body-lg` | Large body | `1rem` | `1.125rem` | `1.25rem` | 400 | `#334155` | Párrafos introductorios, testimonios, callouts. |
| `corp-body` | Default body | `0.875rem` | `1rem` | — | 400 | `#475569` | Párrafos, descripciones, ítems de lista. |
| `corp-body-sm` | Small body | `0.75rem` | `0.875rem` | — | 400 | `#64748b` | Letra chica, footnotes, texto meta. |
| `corp-caption` | Caption | `0.6875rem` | `0.75rem` | `0.875rem` | 400 | `#94a3b8` | Leyenda, crédito de imagen, anotación no crítica. |
| `corp-number` | Dynamic number | *heredado* | — | — | 700 | `#0f172a` | Contadores, stats, puntajes, precios, timers. |
| `corp-number-lg` | Large number | `1.5rem` | `1.75rem` | `2rem` | 700 | `#0f172a` | KPIs destacados, cifras hero, stats grandes. |
| `corp-eyebrow` | Eyebrow label | `0.72rem` | — | — | 600 | `#4f46e5` | Etiqueta contextual sobre headings. Ver §4.2.1. |
| `corp-display` | Display override | *heredado* | — | — | 700 | *heredado* | Fuerza Sora en un elemento no-heading. |
| `corp-gradient-text` | Gradient accent | *heredado* | — | — | — | gradiente índigo→sky | UNA palabra/cifra por vista. Ver §4.2.2. |
| `corp-label` | Field label | `0.72rem` | — | — | 600 | `#334155` | Etiqueta de campo de formulario (parea con `corp-input`). |

#### 4.2.1 Eyebrow — La etiqueta contextual

```css
.corp-eyebrow {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #4f46e5;                    /* indigo-600 */
}
.dark .corp-eyebrow { color: #a5b4fc; }  /* indigo-300 */
```

- **Reemplaza** los micro-labels viejos `font-black uppercase tracking-widest`.
- **Reemplaza** las barras de acento con gradiente (el color índigo del eyebrow
  ya cumple esa función de anclaje visual).
- **Siempre** sobre un heading, nunca solo.

#### 4.2.2 `corp-gradient-text` — Énfasis con moderación

Reservado para destacar una palabra o cifra. El gradiente `#4f46e5 → #2563eb →
#0ea5e9` crea un punto focal que compite con todo lo demás en la vista — por eso
el límite estricto de **un uso por vista**.

#### 4.2.3 Texto en modo oscuro

| Rol | Light | Dark |
|-----|-------|------|
| Título | `text-slate-900` | `dark:text-white` |
| Cuerpo | `text-slate-600` | `dark:text-slate-400` |
| Hero body | `text-slate-600` | `dark:text-slate-300` (ligeramente más claro para compensar fondo oscuro) |
| Muted / meta | `text-slate-500` | `dark:text-slate-400` |
| Acento marca | `text-indigo-600` | `dark:text-indigo-300` |
| Borde | `border-slate-200` | `dark:border-white/10` |

#### 4.2.4 Reglas de pulido tipográfico — APLICACIÓN AUTOMÁTICA VÍA CLASES `corp-*`

Las siguientes reglas de pulido están **incorporadas** en las clases tipográficas
centralizadas. **No es necesario aplicarlas manualmente si se usan las clases `corp-*`.**

| Regla | ¿Cómo se aplica ahora? | Clases que la incluyen |
|-------|------------------------|------------------------|
| `text-balance` en todos los headings | **Automático.** Incluido en cada clase. | `corp-h1`, `corp-h2`, `corp-h3`, `corp-h4` |
| `text-pretty` en todo texto body, párrafos y captions | **Automático.** Incluido en cada clase. | `corp-subtitle-lg`, `corp-subtitle`, `corp-subtitle-sm`, `corp-body-lg`, `corp-body`, `corp-body-sm`, `corp-caption` |
| `tabular-nums` en todos los números dinámicos | **Automático.** Incluido vía `font-variant-numeric`. | `corp-number`, `corp-number-lg` |
| `antialiased` en el `<html>` root | **Manual.** Una sola vez en el layout raíz. | `<html className="antialiased">` |

> **Importante:** Si por alguna razón excepcional se usa un elemento de texto sin
> clase `corp-*` (ej. dentro de un componente third-party), se deben aplicar
> estas reglas manualmente. Pero esto debe ser la excepción, no la norma.

> **Nota sobre `text-balance`:** No aplicar en párrafos largos (>6 líneas) — el
> navegador lo ignora silenciosamente. Para texto largo, usa `text-pretty` o
> deja el wrapping por defecto. Las clases `corp-h1`–`corp-h4` están diseñadas
> para headings (≤4 líneas típicamente), por lo que `text-balance` es seguro.

> **Nota sobre `tabular-nums` con Inter:** La fuente Inter cambia la apariencia
> del dígito `1` con `tabular-nums` (se vuelve más ancho y centrado). Esto es
> esperado y deseable para alineación. Las clases `corp-number` y `corp-number-lg`
> ya aplican `font-variant-numeric: tabular-nums`.

#### 4.2.5 Regla de Oro — Uso obligatorio de clases tipográficas

> **TODO elemento de texto en vistas Corp DEBE usar una de las clases
> tipográficas `corp-*` del catálogo (§4.2). Queda PROHIBIDO componer tamaños
> ad-hoc con utilidades Tailwind (`text-sm font-semibold text-slate-600`,
> `text-lg font-bold`, etc.). Si un caso de uso no encaja en la escala
> existente, se debe justificar en el PR y proponer una extensión de la escala
> en `frontend/src/index.css` §`CORP TYPOGRAPHIC SCALE`.**

Esta regla es **no negociable**. Cualquier agente que genere código de frontend
debe aplicarla sin excepción. Si un agente entrega código con estilos
tipográficos ad-hoc, el código está **incompleto** y debe ser rechazado en
revisión.

### 4.3 Layout y Espaciado — Filosofía mobile-first

El sistema corp sigue una filosofía **mobile-first absoluta**: las clases base
describen el layout móvil, y los breakpoints `sm:` / `md:` / `lg:` escalan hacia
desktop. Nunca se escribe desktop-first y se "reduce" para móvil.

#### 4.3.1 Contenedores

| Ancho | Clases | Cuándo usarlo |
|-------|--------|--------------|
| Amplio (sección) | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | Secciones de landing, contenido de dashboard |
| Copy centrado | `max-w-2xl` o `max-w-3xl` | Texto centrado, testimonios, FAQs |
| Card auth | `max-w-sm` | Islas de login/signup/onboarding |
| Admin / datos densos | `max-w-6xl` | Tablas, dashboards con múltiples columnas |

#### 4.3.2 Ritmo vertical

| Ritmo | Clases | Cuándo usarlo |
|-------|--------|--------------|
| Sección estándar | `py-24` | Separación entre secciones de landing |
| Banda densa | `py-14` | Secciones compactas, footers, CTAs finales |
| Hero | `pt-36 lg:pt-44 pb-20` | Compensa navbar fijo + da respiro visual |
| Espaciado interno | `space-y-6` (cards), `space-y-4` (formularios), `gap-4` (grids) | Ritmo interno de componentes |

#### 4.3.3 Alternancia de fondo

Las secciones consecutivas alternan fondo para crear ritmo visual sin bordes
duros ni separadores explícitos:

```
bg-white → bg-slate-50 → bg-white → bg-slate-50 …
dark:bg-[#070b14] → dark:bg-[#0a0e1a] → …
```

El contraste entre blanco y slate-50 es apenas perceptible en modo claro pero
crea "capítulos" visuales que guían el scroll. En modo oscuro, la diferencia
entre `#070b14` y `#0a0e1a` cumple la misma función.

#### 4.3.4 Alturas de botón

| Altura | Uso |
|--------|-----|
| `h-10` | Botones sociales (Google, Discord), inputs compactos |
| `h-11` | Submit de formulario auth |
| `h-12` | CTA principal en card/modal/hero |

> **Mobile-first en acción:** en móvil (`< sm`), los botones CTA son `w-full`
> (full-width) para facilitar el tap. En desktop (`sm:`), vuelven a `w-auto` o
> `max-w-xs` según el contexto. El padding horizontal y la altura NO cambian entre
> breakpoints — solo el ancho se adapta.

### 4.4 Elevación y Profundidad — Sombras y capas

El sistema corp usa **tres niveles de elevación** para comunicar jerarquía
espacial sin depender de blur, transparencias ni efectos de vidrio.

#### 4.4.1 Escala de sombras

| Nivel | Clase / Uso | Valor | Cuándo usarlo |
|-------|-----------|-------|--------------|
| **0 — Base** | Sin sombra, `bg-slate-50` page | — | Fondo de página |
| **1 — Isla** | Island card `rounded-[2.5rem]` | `0 4px 25px -4px rgba(0,0,0,0.05)` | Cards estáticas grandes, hero, auth islands |
| **2 — Elevada** | `corp-card` hover, `corp-panel` | `0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.18)` | Paneles, cards interactivas |
| **3 — Botón** | `corp-btn-primary` | `0 10px 28px -10px rgba(37,99,235,0.6)` | Botones primarios, elementos accionables |

> **Principio:** las sombras son sutiles y direccionales (hacia abajo). No se usan
> sombras difusas omnidireccionales (`box-shadow: 0 0 40px …`) ni blurs de fondo
> (`backdrop-blur`) en el lenguaje corp. El vidrio esmerilado (`liquid-glass`) es
> exclusivo del sub-estándar Playful (§9).

#### 4.4.2 Z-index y capas

| Capa | z-index | Elementos |
|------|---------|-----------|
| Fondo de página | `0` / auto | `bg-slate-50`, secciones |
| Contenido | `10` (`z-10`) | Islas, cards, contenido dentro de secciones con overflow hidden |
| Navbar fijo | `50` (`z-50`) | `LandingNavbar`, `TopNav`, `AdminSidebar` |
| Modal / overlay | `50` (Radix portal) | `Dialog`, `Sheet`, `Popover` — Radix maneja el z-index vía portal |
| Toast / tooltip | `50+` (Radix portal) | `Sonner`, `Tooltip` — Radix maneja el stacking |

> **Regla:** nunca uses `z-40` o `z-[999]` arbitrarios. Si un elemento necesita
> estar sobre otro, usa los niveles documentados. El portal de Radix resuelve la
> mayoría de los conflictos de stacking.

#### 4.4.3 Sombras sobre bordes para profundidad — TOLERANCIA CERO

Para **botones, cards y contenedores** que comunican elevación, usa `box-shadow`
en lugar de bordes sólidos. Las sombras con transparencia se adaptan a cualquier
fondo; los bordes sólidos no.

| Usa sombras | Usa bordes |
|-------------|-----------|
| Cards, contenedores con profundidad | Divisores entre ítems de lista |
| Botones con estilo outline | Bordes de celdas de tabla |
| Elementos elevados (dropdowns, modales) | Contornos de input de formulario (accesibilidad) |
| Elementos sobre fondos variados | Separadores finos en UI densa |
| Estados hover/focus con efecto de elevación | |

> **Regla:** Nunca uses bordes sólidos (`border`, `border-slate-200`) en cards,
> paneles o contenedores que comunican elevación. Siempre prefiere `box-shadow`
> con transparencia. Esta regla NO aplica a divisores de layout (`border-b`,
> `border-t`) cuyo propósito es separación estructural, no profundidad.

#### 4.4.4 Imágenes — solo bordes redondeados, NUNCA marcos

Toda imagen (`<img>`) en vistas Corp DEBE mostrarse **sin ningún tipo de marco,
borde, outline ni contorno**. La imagen debe respirar libremente dentro del
diseño, interactuando con el fondo directamente. El único tratamiento permitido
es el radio de borde (`rounded-*`), que debe ser consistente con la escala de
radios del sistema.

```tsx
// Correcto — solo bordes redondeados
<img
  className="rounded-xl"
  src={src}
  alt={alt}
/>

// Incorrecto — cualquier tipo de marco
<img
  className="outline outline-1 outline-black/10 rounded-xl"  // ❌
  src={src}
  alt={alt}
/>
<img
  className="border border-slate-200 rounded-xl"             // ❌
  src={src}
  alt={alt}
/>
```

| Permitido | Prohibido |
|-----------|-----------|
| `rounded-*` (sm, md, lg, xl, 2xl, full) | `outline-*` |
| `object-cover`, `object-contain` | `border-*` |
| `shadow-*` sutil para elevación | `ring-*` |
| Imágenes dentro de `corp-card` (el card ya da el marco) | Contornos tintados (slate, zinc, accent) |

> **Tolerancia cero:** cualquier `<img>` en una vista Corp con `outline-*`,
> `border-*` o `ring-*` es un defecto de UI y será rechazado en revisión.

### 4.5 Formas y Radios — La geometría del sistema

El sistema corp usa **dos siluetas de borde** con propósito fijo. No existen
radios intermedios ni one-off.

#### 4.5.1 Escala de radios

| Token | Valor | Uso exclusivo |
|-------|-------|--------------|
| `sm` | `0.5rem` (8px) | Chips, badges pequeños, inputs secundarios |
| `md` | `0.75rem` (12px) | Inputs (`corp-input`), icon chips (`corp-icon-chip`) |
| `lg` | `1rem` (16px) | Cards secundarias, `corp-panel-subtle` |
| `xl` | `1.25rem` (20px) | `corp-card`, `corp-panel` — la silueta estándar |
| `island` | `2.5rem` (40px) | **Solo para islas grandes estáticas** de landing/hero/auth. La silueta distintiva del estilo Island/Brilliant. |
| `full` | `9999px` | Botones (`corp-btn-*`), badges (`corp-badge`), chips, pills |

#### 4.5.2 Reglas de forma

- **Botones:** `rounded-full` (pill completa) — comunica "accionable" sin
  ambigüedad. La silueta circular contrasta con las islas rectangulares.
- **Islas:** `rounded-[2.5rem]` (40px) — el radio característico del estilo
  Brilliant. Suficientemente grande para ser distintivo, no tanto como para
  sentirse lúdico.
- **Cards interactivas:** `rounded-xl` (20px vía `corp-card`) — lo
  suficientemente redondeado para ser amable, lo suficientemente cuadrado para
  densidad de información.
- **Inputs:** `rounded-xl` (`corp-input`) — consistente con el ritmo de cards.
- **Prohibido:** radios arbitrarios con notación bracket (`rounded-[2rem]`,
  `rounded-[18px]`). Si necesitas un radio que no está en la escala, el
  problema es de composición, no de geometría.

#### 4.5.3 Radio de borde concéntrico — TOLERANCIA CERO

Cuando se anidan elementos redondeados, el radio exterior DEBE ser igual al
radio interior más el padding entre ellos:

```
outerRadius = innerRadius + padding
```

Si el padding es mayor a 24px, trata las capas como superficies independientes
y elige cada radio por separado. La regla es más importante cuando las
superficies anidadas están cerca.

**Tabla de mapeo Tailwind para radios concéntricos:**

| Outer (radio) | Padding | Inner (radio) | Ejemplo de uso |
|---------------|---------|---------------|----------------|
| `rounded-2xl` (16px) | `p-2` (8px) | `rounded-lg` (8px) | Card con botón/image anidada |
| `rounded-3xl` (24px) | `p-3` (12px) | `rounded-xl` (12px) | Panel con tabla adentro |
| `rounded-[2.5rem]` (40px) | `p-4` (16px) | `rounded-2xl` (24px) | Isla de auth con formulario |
| `rounded-[2.5rem]` (40px) | `p-6` (24px) | `rounded-2xl` (16px) | Isla de landing con cards internas |

**Ejemplo correcto:**
```tsx
<div className="rounded-2xl p-2">           {/* 16px radio, 8px padding */}
  <div className="rounded-lg">              {/* 8px radio = 16 - 8 ✓ */}
    Contenido
  </div>
</div>
```

**Ejemplo incorrecto:**
```tsx
<div className="rounded-xl p-2">            {/* 12px ambos */}
  <div className="rounded-xl">              {/* mismo radio, se ve mal */}
    Contenido
  </div>
</div>
```

Radios no concéntricos en elementos anidados es una de las causas más comunes
de que una interfaz se sienta "rara" o "desprolija". Siempre calcula
concéntricamente.

#### 4.5.4 Alineación óptica en botones icono+texto

Cuando un botón tiene texto + icono a un lado, el centrado geométrico se ve
desbalanceado. Usa ligeramente menos padding del lado del icono:

```
padding lado-icono = padding lado-texto − 2px
```

```tsx
// CORRECTO — menos padding del lado del icono
<button className="pl-4 pr-3.5 flex items-center gap-2">
  <span>Continuar</span>
  <ArrowRight className="w-4 h-4" />
</button>

// INCORRECTO — padding simétrico, se ve desbalanceado
<button className="px-4 flex items-center gap-2">
  <span>Continuar</span>
  <ArrowRight className="w-4 h-4" />
</button>
```

Esta regla aplica a botones con icono a la derecha (CTA) y a la izquierda
(botones sociales). También aplica a íconos asimétricos (triángulos play,
estrellas, carets) — el mejor fix es ajustar el SVG directamente, o usar
`ml-px` como fallback.

> **Tolerancia cero:** nunca uses padding simétrico (`px-4`) en botones con
> icono a un lado — el botón se verá desbalanceado.

### 4.5.5 Área mínima de toque — 44×44px (WCAG 2.5.5)

Todo elemento interactivo (botones, links, checkboxes, iconos cliqueables)
debe tener un área de toque de al menos **44×44px**. Si el elemento visible
es más pequeño (ej. un checkbox de 20×20, un icono de 16×16), extiende el
área con un pseudo-elemento:

```tsx
<button className="relative size-5 after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2">
  <Icon className="size-5" />
</button>
```

**Regla de colisión:** Si el área extendida se solapa con otro elemento
interactivo, reduce el pseudo-elemento — pero hazlo tan grande como sea
posible sin colisionar. Dos elementos interactivos NUNCA deben tener áreas
de toque solapadas.

> **Tolerancia cero:** cualquier elemento cliqueable/tocable con área menor a
> 44×44px sin extensión de pseudo-elemento es un defecto de accesibilidad.

---

## 5. Catálogo de componentes (clases `corp-*`)

> Todas traen su `.dark` interna. Los **botones** sólo aportan COLOR — el caller
> agrega tamaño/radio/padding/flex.

### 5.1 Superficies

| Clase | Uso |
|-------|-----|
| `corp-card` | Card **interactiva** (hover lift). Para islas grandes/estáticas, prefiere clases raw: `bg-white rounded-[2.5rem] p-8 shadow-sm`. |
| `corp-panel` | Superficie **estática** (sin hover): secciones, headers, sidebars, barras de filtro. |
| `corp-panel-subtle` | Panel anidado / filas de lista. |
| `corp-dialog` | Sólo para `DialogContent` de Radix (sin transform, evita el bug de centrado). Añade `rounded-3xl`. |

> **Migración:** `<GlassPanel variant="subtle">` → `corp-panel-subtle`;
> `<GlassPanel>` / `variant="strong"` → `corp-card` (interactiva) o `corp-panel`
> (estática). Elimina el import de `GlassPanel` al terminar.

> **`liquid-glass*` (DEPRECADO).** Las clases `liquid-glass`, `liquid-glass-subtle`
> y `liquid-glass-strong` fueron **redefinidas en `index.css` para renderizar como
> superficies corp planas** (sin blur/glow). Esto corp-ifica de golpe todos los
> primitivos shadcn que las traen horneadas por defecto (`ui/card`, `ui/dialog`,
> `ui/select`, `ui/popover`, `ui/dropdown-menu`, `ui/tooltip`, `ui/tabs`,
> `ui/sheet`, `ui/drawer`, `ui/menubar`) + `ThemeToggle` + `LanguageSelector`. **No
> uses `liquid-glass*` en código nuevo** — usa `corp-card` / `corp-panel` /
> `corp-dialog`. Los juegos y el motor de lecciones NO usan estas clases (tienen
> su propio CSS), así que su look lúdico no se ve afectado.

### 5.2 Botones

| Clase | Uso |
|-------|-----|
| `corp-btn-primary` | Acción principal (gradiente índigo→azul). |
| `corp-btn-secondary` | Acción neutra / outline. |
| `corp-btn-ghost` | Texto/icono sin fondo. |
| `corp-btn-danger` | Destructivo (eliminar). |

```tsx
{/* primario, full width */}
<button className="corp-btn-primary w-full h-12 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2">
  {t('x.cta')} <ArrowRight className="w-4 h-4" />
</button>
{/* secundario */}
<button className="corp-btn-secondary h-11 rounded-xl px-5 text-sm font-semibold">…</button>
```

**Estado loading:** spinner `<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />` o `<Loader2 className="w-4 h-4 animate-spin" />`.
**Disabled:** `disabled:opacity-50 disabled:cursor-not-allowed`.
**Botones sobre panel oscuro:** primario = `bg-white text-indigo-700 hover:bg-indigo-50`; secundario = `border border-white/25 text-white hover:bg-white/10`.

### 5.3 Formularios

```tsx
<div className="space-y-1.5">
  <label htmlFor="email" className="corp-label">{t('auth:fields.email.label')}</label>
  <div className="relative">
    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    <input id="email" type="email" className="corp-input h-10 pl-10" />
  </div>
</div>
```

- `corp-input` aplica a `<input>`, `<textarea>` y al `SelectTrigger` de shadcn.
- Error: añade `corp-input--error`; texto `text-red-500 text-xs font-semibold`.
- También funciona sobre el `<Input>` de shadcn (sobrescribe sus utilidades).

### 5.4 Badges, tablas, chips, vacío

| Clase | Uso |
|-------|-----|
| `corp-badge` (+ `--brand` `--info` `--success` `--warning` `--danger`) | Pills de estado/rol. |
| `corp-table` | Aplícala al `<table>` o `<Table>` de shadcn — re-estiliza `thead/tbody` completos. |
| `corp-icon-chip` | Contenedor de icono tintado índigo (caller agrega `w-10 h-10`). |
| `corp-empty` | Estado vacío centrado (icono + texto muted). |

```tsx
<span className="corp-badge corp-badge--success">{t('x.active')}</span>
<table className="corp-table">…</table>
<div className="corp-icon-chip w-10 h-10"><Icon className="w-5 h-5" /></div>
```

### 5.5 Modales (Radix Dialog)

```tsx
<DialogContent className="corp corp-dialog rounded-3xl sm:max-w-lg p-6">…</DialogContent>
```

`corp` opta el portal a Inter/Sora; `corp-dialog` da la superficie sin el hover
transform. **Nunca** `corp-card` en un Dialog (pelea con el centrado de Radix —
ver commit `0493588`).

---

## 6. Patrones de página

### 6.1 Eyebrow + título de sección

```tsx
<span className="corp-eyebrow">{t('x.kicker')}</span>
<h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">{t('x.title')}</h2>
<p className="mt-4 text-slate-600 dark:text-slate-400 leading-relaxed">{t('x.sub')}</p>
```

> Reemplaza los micro-labels `font-black uppercase tracking-widest` por
> `corp-eyebrow`. Reemplaza las barras de acento gradiente por `corp-eyebrow`.

### 6.2 Header de página (cuenta / admin)

```tsx
<div className="corp-panel p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
  <div>
    <span className="corp-eyebrow">{t('app_name')}</span>
    <h1 className="corp-display mt-1 text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{t('x.title')}</h1>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('x.subtitle')}</p>
  </div>
  {/* slot de acción opcional: <button className="corp-btn-primary …"> */}
</div>
```

### 6.3 Stat card (KPI)

```tsx
<div className="corp-card p-6">
  <div className="corp-icon-chip w-11 h-11"><Icon className="w-5 h-5" /></div>
  <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
  <p className="mt-1 corp-eyebrow">{t('x.label')}</p>
</div>
```

### 6.4 Tabla admin

```tsx
<div className="corp-panel overflow-hidden">
  <Table className="corp-table">
    <TableHeader><TableRow><TableHead>{t('x.col')}</TableHead>…</TableRow></TableHeader>
    <TableBody>…</TableBody>
  </Table>
</div>
```

### 6.5 Animación de entrada

- **Marketing (LandingLayout):** componente `<Reveal>` (variant `up/left/right/scale`, `delay`).
- **Standalone (auth):** utilidades Tailwind `animate-in fade-in zoom-in-95`.
- Respeta `prefers-reduced-motion` (ya cubierto por `.reveal` y `animate-in`).

---

## 7. Reglas DO / DON'T

### DO — Patrones requeridos

| Regla | Razón |
|-------|-------|
| Usa `corp-*` y la paleta slate+índigo | Consistencia visual: cada vista se lee como parte del mismo producto. |
| Cada utilidad de color con su `dark:` | Sin `dark:`, el texto se vuelve ilegible en modo oscuro. Las clases `corp-*` ya incluyen su `.dark` — no les agregues `dark:`. |
| `t()` en todo texto visible | i18n obligatorio. Sin `t()`, el texto queda hardcodeado en un solo idioma. |
| `id`/anclas/handlers intactos al migrar | Los `id` son anclas para tours, tests y accesibilidad. Romperlos quiebra funcionalidad. |
| Mobile-first: clases base para móvil, `sm:`/`lg:` para desktop | El 60%+ del tráfico es móvil. Escribir desktop-first genera deuda de responsive. |
| Iconos `lucide-react` | Único set de iconos del proyecto. No mezcles con otros packs (FontAwesome, Material). |
| `corp-eyebrow` sobre cada heading de sección | El eyebrow da contexto de categoría y ancla visualmente la sección (§4.2.1). |
| Usa `corp-gradient-text` para máximo UNA palabra/cifra por vista | El gradiente es un punto focal; abusar destruye la jerarquía (§4.2.2). |
| Usa clases `corp-*` tipográficas para TODO texto visible | `corp-h1`–`corp-h4`, `corp-subtitle-*`, `corp-body-*`, `corp-number-*`. Nada de `text-sm font-semibold` ad-hoc (§4.2.5). |
| `text-balance`, `text-pretty`, `tabular-nums` ya están incluidos en las clases `corp-*` | No aplicar manualmente si ya se usa la clase `corp-*` correspondiente (§4.2.4). |
| Las imágenes usan solo bordes redondeados — NUNCA marcos, outlines ni bordes | La imagen debe integrarse limpiamente con el diseño (§4.4.4). |
| Respeta `prefers-reduced-motion` en todas las animaciones | Accesibilidad: usuarios con sensibilidad a motion (§11.3.8). |
| Usa `active:scale-[0.96]` para feedback táctil en botones | Micro-interacción que confirma el tap sin ser invasiva (§11.3.1). |
| Calcula radio concéntrico en elementos anidados | `outerRadius = innerRadius + padding`; evita que la UI se sienta "rara" (§4.5.3). |
| Usa menos padding del lado del icono en botones icono+texto | `padding-icono = padding-texto − 2px`; alineación óptica (§4.5.4). |
| Asegura ≥44×44px de área de toque en todo elemento interactivo | WCAG 2.5.5; extiende con pseudo-elemento si el elemento es pequeño (§4.5.5). |

### DON'T — Patrones prohibidos

| Prohibición | Razón | Alternativa |
|-------------|-------|-------------|
| `liquid-glass*` / `GlassPanel` en código nuevo | Las clases legacy ya renderizan corp (§5.1). Nuevo código debe usar `corp-*` directamente. | `corp-card` / `corp-panel` / `corp-dialog` |
| Gradientes multi-stop `blue→purple→pink` | Identidad lúdica vieja. Rompe la seriedad del lenguaje corp. | Acentos `violet`/`fuchsia` mesurados (§4.1.3) |
| Acentos dominados por `pink`/`rose` decorativo | El rosa de la marca infantil anterior NO pertenece a corp. | `indigo`/`blue`/`sky` para marca |
| Sistemas de color "arcoíris" por-ítem | Fatiga visual y rompe jerarquía: si todo es color, nada destaca. | Slate neutro + un acento por vista |
| Títulos `font-black` con gradiente multi-stop | Look lúdico viejo. Demasiado peso tipográfico para corp. | Sora `font-bold` + `corp-gradient-text` medido |
| Blobs "ambient glow" decorativos y `corp-grid-bg` | REMOVIDOS a favor del estilo limpio slate-50. Añaden ruido visual sin función. | Fondo sólido `bg-slate-50` |
| Micro-labels `font-black uppercase tracking-widest` | Demasiado agresivos. El tracking excesivo reduce legibilidad. | `corp-eyebrow` (§4.2.1) |
| `dark:` sobre clases `corp-*` | Las clases `corp-*` ya traen su variante `.dark` interna en `index.css`. Duplicar `dark:` crea conflictos de especificidad. | Confía en la variante interna de cada clase |
| Radios arbitrarios (`rounded-[2rem]`, `rounded-[18px]`) | La escala de radios (§4.5.1) cubre todos los casos. Radios one-off crean inconsistencia. | Usa los tokens de la escala: `sm`, `md`, `lg`, `xl`, `island`, `full` |
| `backdrop-blur` apilado | Efecto de vidrio esmerilado exclusivo de Playful. En corp, añade peso de renderizado sin beneficio. | Sombras limpias (§4.4.1) |
| `hover:scale-*` bespoke | `corp-card` ya implementa hover lift con `translateY(-4px)`. Escalas adicionales compiten. | Confía en `corp-card` o usa `corp-btn-*` |
| Clases Tailwind dinámicas (`bg-${color}-500/10`) | Tailwind JIT no puede analizar strings concatenados en runtime → la clase no se genera. | Mapa estático: `const colorMap = { indigo: 'bg-indigo-500/10', … }` |
| `corp-card` en un `DialogContent` de Radix | El `transform` del hover de `corp-card` interfiere con el centrado del portal de Radix (commit `0493588`). | `corp-dialog` (§5.5) |
| Crear una tercera categoría visual "estilo propio" | Solo existen Corp (§1-8) y Playful (§9). Una tercera categoría fragmenta la identidad del producto. | Alinea la vista a Corp o Playful según corresponda |
| `transition: all` o `transition` (shorthand sin propiedades explícitas) | Fuerza al navegador a observar TODAS las propiedades; causa transiciones inesperadas e impide optimizaciones (§11.3.5). | `transition-[scale,opacity]` o `transition-transform` |
| `will-change: all` | Crea capas de composición innecesarias para propiedades no GPU-compositable (§11.3.6). | `will-change: transform` (solo si hay stutter en primer frame) |
| `@keyframes` para elementos interactivos (hover, toggle, open/close) | Los keyframes no son interruptibles — si el usuario cambia de intención a mitad de animación, se rompe (§11.3.7). | CSS `transition` para interactivos |
| Animaciones >500ms para UI | Viola WCAG 2.3.1; fatiga al usuario. | ≤300ms para Corp, ≤400ms para Playful |
| `scale()` < 0.95 en press de botones | Se siente exagerado y poco profesional (§11.3.1). | `scale(0.96)` exclusivamente |
| Animar `width`, `height`, `margin`, `padding` | No son GPU-compositable; causan layout thrashing y jank. | Anima `transform` y `opacity` |
| Canvas sin `devicePixelRatio` cap | Consumo excesivo de GPU en pantallas retina. | `Math.min(window.devicePixelRatio, 2)` |
| Fondos animados sin `pointer-events: none` | Bloquean interacción del usuario con el contenido real. | `pointer-events: none` en fondos decorativos |
| Animaciones sin `aria-label` en texto animado | El contenido animado puede ser invisible para lectores de pantalla durante la transición. | `aria-label` con el texto completo |

---

## 8. Checklist de migración por página

1. ¿Dónde va el scope? (root standalone / `AdminLayout` / wrapper de contenido — §1.2, §2).
2. Fondo → fondo corp (§3) o quitar gradiente lúdico.
3. `GlassPanel`/`liquid-glass` → `corp-card` / `corp-panel` / `corp-panel-subtle`.
4. Botones → `corp-btn-*`. Inputs/Selects → `corp-input` + `corp-label`.
5. Badges → `corp-badge*`. Tablas → `corp-table`. Vacíos → `corp-empty`.
6. Micro-labels y barras de acento → `corp-eyebrow`. Títulos y texto → clases `corp-*` tipográficas (§4.2.5).
7. Borrar blobs decorativos, shimmer, `hover:scale-*`, imports muertos.
8. **Preservar** lógica/estado/fetch/rutas/`id`/`t()`/props **sin cambios**.
9. Gates: `npm run type-check`, `npm run lint`, `npm test` en `frontend/`.

---

## 9. Sub-estándar "Playful" (vistas de niños — informativo)

Las vistas exentas (§1.1) tienen su propio estándar **documentado** para que no
sean "estilo libre":

- **Arquitectura de juegos:** cada juego en `frontend/src/games/{slug}/` con
  `types.ts`, `constants.ts`, `gameReducer.ts`, `{slug}.css` (define
  `.game-fullscreen`), `{Slug}Page.tsx`, `index.ts`, `components/`. Ver
  `frontend/FRONTEND_GUIDE.md §6` y `AGENTS.md`.
- **Tipografía:** Nunito. Colores vivos
  (índigo/violeta/fucsia/esmeralda/ámbar), gradientes lúdicos, `liquid-glass`
  permitido **sólo aquí**.
- **Sonido:** `useSound()` de `@/contexts/SoundContext`.
- **i18n:** namespace por juego en `i18n/locales/{es,en}/games.json` (o namespace
  dedicado, p. ej. `hackerDefense`).
- **Regla de Oro de Layout (Centrado Absoluto 0,0 X,Y):** En el Lesson Engine (`LessonRunner`), la agrupación compuesta por personaje + burbuja de diálogo + tarjetas/actividades de ejercicio (excluyendo la barra superior de progreso) DEBE estar bidimensionalmente centrada en el punto (0,0) de los ejes X y Y respecto al viewport. En desktop (`lg:flex-row`), el personaje ocupa la columna izquierda (`lg:w-1/3`) y el ejercicio la derecha (`lg:w-2/3`), centrados con `items-center justify-center`. En mobile (`flex-col`), se apilan verticalmente con `items-center justify-center`. Se prohíbe el uso de paddings superiores o posiciones sticky desalineadas.

### 9.1 Lesson Engine — modo oscuro (tokens `--lp-*`) y i18n (auditoría 2026-07)

- **Modo oscuro por tokens, NO por `dark:` sueltos.** El motor vive bajo el scope `.lp` (raíz de `LessonRunner`). Los colores se definen con variables `--lp-*` (superficie, tinta, líneas, hues), que se voltean automáticamente en `.dark .lp` (ver `frontend/src/index.css`). **Regla:** dentro de un componente de actividad usa `var(--lp-surface)` / `var(--lp-ink)` / `var(--lp-muted)` / `lp-card`, NO colores crudos claros (`bg-white`, `text-slate-900`, `border-slate-100`). Existe además una **red de seguridad**: `.dark .lp .bg-white|.text-slate-*|.border-slate-*` se remapea a los tokens, así que un `bg-white` que se cuele NO rompe el modo oscuro — pero **prefiere el token** en código nuevo. La regla está protegida por `src/__tests__/lessonEngineDarkMode.test.ts` (no la borres sin reemplazarla).
- **i18n obligatorio, con clave real.** Toda cadena visible del motor (texto, `aria-label`, `placeholder`, mensajes de feedback) pasa por `t('…')` del namespace `lessons` **y su clave DEBE existir en `es/lessons.json` Y `en/lessons.json`** (mantén paridad). `defaultValue` es sólo un fallback: si la clave falta, i18next muestra el `defaultValue` en AMBOS idiomas → inglés vería español. Invariante: *cada `t()` del motor tiene su clave en los dos locales*. Ojo: `feedback.success`/`feedback.error` son MENSAJES ("¡Correcto!"/"Inténtalo de nuevo"), no etiquetas de botón (los botones usan `actions.continue`/`actions.retry`).
- **Contrato de datos ≡ taxonomía.** Los tipos, `required_content` y la clave canónica de `correct_answer` de cada ejercicio son la fuente única `backend/lesson_factory/schema/exercise_registry.json` (regenera los tipos TS del frontend con `python3 backend/lesson_factory/schema/gen_frontend_types.py`; la CI de la fábrica falla si quedan desincronizados). No inventes formas de `content`/`correct_answer` fuera del registro.

> **Regla de oro:** una vista o es **Corp** (§1–§8) o es **Playful** (§9). No
> existe una tercera categoría "estilo propio". Si encuentras una vista que no
> cae en ninguna de las dos, es deuda — alinéala a la que corresponda.

---

## 10. Referencias Cruzadas — Dónde se implementa cada token

### 10.1 Archivos fuente

| Token / Sección DESIGN.md | Archivo de implementación | Línea / Sección en el archivo |
|---------------------------|--------------------------|-------------------------------|
| YAML front matter (tokens) | `frontend/DESIGN.md` | Líneas 1–128 |
| Colores corp primarios | `frontend/src/index.css` | `CORPORATE MARKETING SYSTEM` (línea ~2348) + `CORP SYSTEM — APP / ADMIN PRIMITIVES` (línea ~2521) |
| Tipografía `.corp` scope (Inter/Sora) | `frontend/src/index.css` | `.corp, .corp button, …` (línea ~2351) |
| Clases tipográficas `corp-h1`–`corp-number-lg` | `frontend/src/index.css` | `CORP TYPOGRAPHIC SCALE` (línea ~2396) |
| `corp-card` | `frontend/src/index.css` | `.corp-card` (línea ~2571) |
| `corp-panel`, `corp-panel-subtle` | `frontend/src/index.css` | `.corp-panel`, `.corp-panel-subtle` (línea ~2547) |
| `corp-btn-primary/secondary/ghost/danger` | `frontend/src/index.css` | `.corp-btn-*` (línea ~2437, ~2618, ~2642, ~2652) |
| `corp-input`, `corp-label` | `frontend/src/index.css` | `.corp-input` (línea ~2570), `.corp-label` (línea ~2607) |
| `corp-badge`, `corp-table`, `corp-icon-chip`, `corp-empty` | `frontend/src/index.css` | `.corp-badge` (línea ~2668), `.corp-table` (línea ~2695), `.corp-icon-chip` (línea ~2719), `.corp-empty` (línea ~2731) |
| `corp-eyebrow`, `corp-gradient-text` | `frontend/src/index.css` | `.corp-eyebrow` (línea ~2383), `.corp-gradient-text` (línea ~2375) |
| `liquid-glass*` → corp compat | `frontend/src/index.css` | `LEGACY liquid-glass* → CORP COMPAT ALIASES` (línea ~2742) |
| Configuración Tailwind (HSL tokens) | `frontend/tailwind.config.ts` | `theme.extend.colors` (línea 21–100) |
| Lesson Engine (`.lp`) tokens | `frontend/src/index.css` | `LESSON ENGINE — PLAYFUL DS v2` (línea ~2840) |
| Estándar visual corp (este documento) | `CLAUDE.md` §1, §3 | Línea 15, 56 |
| Estándar visual corp (este documento) | `AGENTS.md` §1, §3 | Línea 15, 56 |
| Guía técnica frontend | `frontend/FRONTEND_GUIDE.md` | Encabezado + §16 |

### 10.2 Skills de diseño aplicables

Las skills de diseño complementan este documento. Invócalas antes de generar
código UI según el tipo de tarea:

| Skill | Cuándo | Ubicación |
|-------|--------|-----------|
| `agave` | Crear, revisar o modificar UI | `.claude/skills/agave/` |
| `emil-design-eng` | Escribir animaciones, decisiones de motion | `.claude/skills/emil-design-eng/` |
| `impeccable` | Diseñar, rediseñar, auditar, pulir interfaces | `.claude/skills/impeccable/` |
| `review-animations` | Revisar código de animación/motion existente | `.claude/skills/review-animations/` |
| `react-bits` | Patrones de componentes animados (text reveal, hover effects, backgrounds) | `.claude/skills/react-bits/` |
| `make-interfaces-feel-better` | Pulido de UI: tipografía, superficies, animaciones, performance | `.claude/skills/make-interfaces-feel-better/` |

> Las skills refinan la ejecución; este DESIGN.md define los tokens y clases
> `corp-*`. Ver `CLAUDE.md` §4 para el catálogo completo y reglas de uso.

---

## 11. Animaciones y Motion

### 11.1 Filosofía de motion

LittleFounders tiene **dos filosofías de motion** alineadas con sus dos
lenguajes visuales. Las reglas de este capítulo aplican a **ambas**, pero con
distinta intensidad según el contexto:

| Vista | Filosofía | Librería | Intensidad |
|-------|-----------|----------|------------|
| **Corp** (§1–§8) | Motion sutil, con propósito definido. Las animaciones existen para dar feedback y guiar la atención, nunca para decorar. **Menos es más.** | Framer Motion (`motion/react`) + CSS transitions | Sin animaciones decorativas. Sin partículas. Sin efectos de hover dramáticos. Sin blur en enter animations. |
| **Playful** (§9) | Motion expresivo y lúdico. Las animaciones son parte de la experiencia inmersiva. Pueden ser más largas, más coloridas, más presentes. | Framer Motion + CSS keyframes + Canvas API | Se permiten partículas, efectos de fondo, transiciones dramáticas, blur, escalas. |

### 11.2 Tokens de motion

Los tokens de motion están definidos en el YAML front matter de este documento
(sección `motion:`). Valores canónicos:

| Token | Valor | Dónde se usa |
|-------|-------|-------------|
| `feedback` | 120ms | Micro-interacciones: hover, focus, toggle, scale-on-press |
| `content` | 250ms | Transiciones de contenido: enter/exit de cards, modales, drawers |
| `easing` | `cubic-bezier(0.2, 0, 0, 1)` | Curva de easing estándar para todas las transiciones Corp |
| `scale-press` | `0.96` | Escala en `:active` / `whileTap` para feedback táctil |
| `icon-spring` | spring 300ms bounce=0 | Intercambio de iconos con AnimatePresence |
| `stagger-delay` | 100ms | Retraso entre hijos en animaciones staggered |

### 11.3 Reglas de animación — MANDATOS NO NEGOCIABLES

Las siguientes reglas aplican a **todo** el código de frontend, Corp y Playful
por igual. Cualquier violación es un defecto que debe ser corregido antes de
merge. No existen excepciones.

#### 11.3.1 Scale on press

```tsx
// Tailwind — forma canónica
<button className="transition-transform duration-150 ease-out active:scale-[0.96]">
  Click
</button>

// Framer Motion — alternativa
<motion.button whileTap={{ scale: 0.96 }}>
  Click
</motion.button>
```

- **SIEMPRE** usa `scale(0.96)`. Es el valor canónico del token `motion.scale-press`.
- **NUNCA** uses un valor menor a `0.95` — se siente exagerado y poco profesional.
- **NUNCA** uses `hover:scale-*` bespoke — `corp-card` ya implementa hover lift
  con `translateY(-4px)` + sombra. Escalas adicionales compiten con el sistema.
- Usa CSS transitions para interruptibilidad — si el usuario suelta a mitad
  del press, el botón debe regresar suavemente a su estado natural.
- Provee un prop `static` para desactivar el efecto cuando el motion
  distraiga (ej. en tabs, toggles, controles de formulario, filas de tabla).

#### 11.3.2 Intercambio contextual de iconos

Cuando un icono cambia de estado (play→pause, like→liked, activo→inactivo),
anima con `opacity`, `scale` y `blur`. Usa **EXACTAMENTE** estos valores —
está prohibido modificarlos:

| Propiedad | Inicial | Final |
|-----------|---------|-------|
| `scale` | `0.25` | `1` |
| `opacity` | `0` | `1` |
| `filter` | `blur(4px)` | `blur(0px)` |
| `transition` | `{ type: "spring", duration: 0.3, bounce: 0 }` | — |

```tsx
// Con Framer Motion (el proyecto ya tiene motion/react)
import { AnimatePresence, motion } from "motion/react";

<AnimatePresence mode="popLayout" initial={false}>
  <motion.span
    key={isActive ? "active" : "inactive"}
    initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
  >
    <Icon />
  </motion.span>
</AnimatePresence>
```

**Reglas obligatorias:**
- `bounce` siempre debe ser `0` — nunca `0.1`, `0.2` ni otro valor.
- `initial={false}` en `AnimatePresence` para evitar animación en carga
  inicial de página. No aplicar en heroes o staggered enters que dependen
  de su `initial` prop para la primera animación.
- `mode="popLayout"` para que el icono saliente no empuje al entrante.
- `scale: 0.25` es el valor inicial — nunca uses `0.5`, `0.6` ni otro.

#### 11.3.3 Stagger de hijos

Divide el contenido en grupos semánticos y aplica stagger de ~100ms entre
grupos. No animes un solo contenedor grande — divide y staggea.

```tsx
const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

<motion.div
  initial="hidden"
  animate="visible"
  variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
>
  <motion.h1 variants={item}>Título</motion.h1>
  <motion.p variants={item}>Descripción</motion.p>
  <motion.div variants={item}><Button>CTA</Button></motion.div>
</motion.div>
```

- **Corp:** usa solo `opacity` + `translateY(12px)` — sin blur, sin escala.
- **Playful:** puede usar `opacity` + `translateY` + `blur` para más impacto.
- Stagger delay = ~100ms entre grupos semánticos (título → descripción → botones).
- Para títulos con palabras individuales: ~80ms por palabra.
- Para frases: ~100ms por frase.

#### 11.3.4 Animaciones de salida

Las animaciones de salida deben ser **más cortas y más sutiles** que las de
entrada. El foco del usuario ya está en lo que sigue — no compitas por atención.

```tsx
<motion.div
  exit={{
    opacity: 0,
    y: -12,
    filter: "blur(4px)",
    transition: { duration: 0.15, ease: "easeIn" },
  }}
>
  {content}
</motion.div>
```

- Usa un `translateY` fijo pequeño (ej. `-12px`), **nunca** el alto completo
  del contenedor ni `-100%`.
- Duración de salida < duración de entrada (~150ms vs ~300ms).
- Mantén movimiento direccional para indicar hacia dónde fue el elemento.
- **Nunca** elimines la animación de salida por completo — `display: none`
  instantáneo rompe el contexto espacial del usuario.

#### 11.3.5 PROHIBIDO: `transition: all`

**Prohibición absoluta** en todo el proyecto, sin excepciones:

```tsx
// INCORRECTO — NUNCA hagas esto
<button className="transition duration-150">
<button className="transition-all duration-150">

// CORRECTO — especifica propiedades exactas
<button className="transition-[scale,background-color] duration-150">
<button className="transition-transform duration-150">  {/* cubre transform, translate, scale, rotate */}
<button className="transition-[box-shadow] duration-150">
```

- `transition: all` fuerza al navegador a observar CADA propiedad CSS.
- Causa transiciones inesperadas en propiedades no intencionadas (color,
  padding, sombras).
- Impide optimizaciones del motor de renderizado.
- `transition-transform` de Tailwind es seguro: mapea a `transform,
  translate, scale, rotate` — solo propiedades GPU-compositable.

#### 11.3.6 `will-change` solo en propiedades GPU-compositable

```css
/* CORRECTO — propiedades que la GPU puede componer */
.animated-card { will-change: transform; }
.animated-fade { will-change: transform, opacity; }
.animated-blur { will-change: filter; }

/* INCORRECTO — NUNCA */
.animated-card { will-change: all; }
.animated-card { will-change: background-color, padding; }
```

- Solo `transform`, `opacity`, `filter`, `clip-path` — propiedades que la GPU
  puede componer en su propia capa.
- **NUNCA** uses `will-change: all`.
- Solo agrega `will-change` cuando notes stutter en el primer frame de una
  animación. No lo agregues preventivamente — cada capa de composición extra
  consume memoria GPU.
- Remueve `will-change` cuando la animación termina (o usa
  `animationend`/`transitionend` para limpiar).
- Safari se beneficia más de `will-change` que Chrome/Firefox — prioriza
  testear en Safari.

#### 11.3.7 CSS transitions para interactivos, keyframes para one-shot

| Tipo de animación | Herramienta | ¿Interrumpible? |
|-------------------|-------------|-----------------|
| Estados interactivos (hover, toggle, open/close, focus) | CSS `transition` | **Sí** — reorienta a mitad de animación sin glitch |
| Secuencias one-shot (enter animations, loading, splash) | CSS `@keyframes` | **No** — reinicia desde el principio si se interrumpe |

```css
/* CORRECTO — transition para drawer interactivo */
.drawer {
  transform: translateX(-100%);
  transition: transform 200ms ease-out;
}
.drawer.open { transform: translateX(0); }
/* Si el usuario cierra a mitad de apertura, la animación se revierte suavemente */

/* INCORRECTO — keyframe para elemento interactivo */
.drawer.open {
  animation: slideIn 200ms ease-out forwards;
}
/* Si el usuario cierra a mitad de apertura, la animación se reinicia o glitchea */
```

**Regla de oro:** Siempre prefiere CSS transitions para elementos que
responden a interacción del usuario. Reserva `@keyframes` para secuencias
que se ejecutan una sola vez (entrada de página, skeleton shimmer, spinners).

#### 11.3.8 `prefers-reduced-motion` — TOLERANCIA CERO

TODA animación, sin excepción, DEBE respetar la preferencia del sistema
operativo `prefers-reduced-motion`:

```css
/* CSS global — en index.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// Tailwind — modificadores motion-safe / motion-reduce
<div className="motion-safe:animate-fadeIn motion-reduce:animate-none">
```

```tsx
// Framer Motion — hook useReducedMotion()
import { useReducedMotion } from "motion/react";

const prefersReduced = useReducedMotion();
const duration = prefersReduced ? 0 : 0.3;
```

**Cualquier animación sin soporte para `prefers-reduced-motion` es un
defecto de accesibilidad y será rechazada en revisión.**

#### 11.3.9 Elevación de card en hover

```tsx
// Corp — solo translateY sutil, sin escala
<motion.div whileHover={{ y: -4 }} transition={{ type: "spring", duration: 0.3, bounce: 0 }}>

// Playful — puede ser más expresivo
<motion.div whileHover={{ y: -6, scale: 1.02 }}>
```

- `corp-card` ya implementa `translateY(-4px)` en hover con sombra de
  elevación. No agregues `hover:scale-*` adicional.
- En Corp, **nunca** uses efectos de hover como tilt 3D, spotlight,
  magnetic buttons ni image reveals — estos patrones son exclusivos de
  Playful (ver §11.4).

#### 11.3.10 Estados de carga — shimmer skeleton

Para estados de carga en vistas Corp, usa skeleton shimmer. Nunca un
spinner estático solitario sin contexto:

```tsx
// Skeleton shimmer con Tailwind
<div className="space-y-4 animate-pulse">
  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
</div>

// O usa el componente Skeleton de shadcn/ui
<Skeleton className="h-4 w-3/4" />
```

- El shimmer comunica "contenido cargando"; el spinner comunica "espera
  indefinida".
- Usa `animate-pulse` de Tailwind o el componente `<Skeleton>` de shadcn/ui.
- En Playful, los skeletons pueden ser más expresivos (colores, formas).

#### 11.3.11 Reglas de rendimiento de animación

- **Solo anima `transform` y `opacity`** — son las únicas propiedades que
  la GPU puede componer sin triggers de layout/paint.
- **NUNCA animes** `width`, `height`, `top`, `left`, `margin`, `padding` —
  disparan layout/reflow y causan jank.
- Canvas: usa `devicePixelRatio` cap (`Math.min(window.devicePixelRatio, 2)`).
- Fondos decorativos: `pointer-events: none` para no bloquear interacción.
- `IntersectionObserver` para pausar animaciones fuera de viewport.
- Texto animado: provee `aria-label` con el texto completo para lectores
  de pantalla.
- Duración máxima de animaciones UI: 400ms (WCAG 2.3.1). Corp: ≤300ms.

### 11.4 Catálogo de patrones React Bits — Aprobación por vista

Los siguientes patrones del ecosistema React Bits / Framer Motion tienen
aprobación condicionada según la vista:

| Patrón | Corp | Playful | Notas |
|--------|------|---------|-------|
| **Text Reveal (blur + translateY)** | ✅ Solo en H1 hero de landing | ✅ En cualquier heading | En Corp, un solo uso por página. Sin blur — solo opacity + translateY. |
| **Split Text (caracteres/palabras)** | ❌ Prohibido | ✅ Permitido | Demasiado llamativo y "tech demo" para Corp. |
| **Wave Text** | ❌ Prohibido | ✅ En títulos de lección | Efecto lúdico; no pertenece al chrome serio. |
| **Count Up (números)** | ✅ En KPIs, stats y dashboards | ✅ En scores y contadores | Usar SIEMPRE con `tabular-nums`. En Corp, easing lineal sin spring. |
| **Typewriter** | ❌ Prohibido | ✅ En narrativa de lecciones | Corp no es una experiencia de lectura cinética. |
| **Magnetic buttons** | ❌ Prohibido | ✅ En juegos y menús | Efecto "juguete" — rompe la seriedad Corp. |
| **Spotlight cards** | ❌ Prohibido | ✅ En catálogos de juegos | Gradiente radial siguiendo cursor — demasiado dramático. |
| **Tilt cards (3D perspective)** | ❌ Prohibido | ✅ En selección de personaje | Usa `perspective` + `rotateX/Y` — no es Corp. |
| **Parallax scroll** | ✅ Sutil (≤20px desplazamiento) | ✅ Libre | En Corp, desplazamiento imperceptible — un detalle, no un efecto. |
| **Particle backgrounds (Canvas)** | ❌ Prohibido | ✅ En juegos y lecciones | Canvas/WebGL solo en contexto de gameplay. |
| **Gradient animations (CSS)** | ❌ Prohibido | ✅ En fondos de lección | Corp usa fondos sólidos slate; sin animaciones de fondo. |
| **Staggered list enter** | ✅ En listas, cards y grids | ✅ En cualquier contenido | En Corp: solo opacity + translateY(12px), sin blur. En Playful: con blur. |
| **Hover elevation (translateY)** | ✅ `-4px` en `corp-card` | ✅ Puede ser mayor | Corp: -4px máximo. Playful: hasta -8px. |
| **Image reveal (clip-path)** | ❌ Prohibido | ✅ En galerías de juegos | Efecto demasiado elaborado para Corp. |
| **Page transitions** | ✅ Opacity cross-fade (150ms) | ✅ Slide + fade | Corp: solo cross-fade sutil. Playful: transiciones direccionales. |

### 11.5 Checklist de revisión de animaciones

Antes de merge, todo agente DEBE verificar su código de animación contra
esta lista. Si un ítem falla, el código está incompleto:

- [ ] No existe `transition: all` ni `transition` (shorthand) en ningún
      componente ni hoja de estilo
- [ ] `will-change` solo se usa en `transform`, `opacity`, `filter` —
      nunca `all` ni propiedades no GPU-compositable
- [ ] `scale(0.96)` es el único valor de scale-on-press — nunca < 0.95
- [ ] `AnimatePresence` usa `initial={false}` en iconos, toggles y tabs
      (no en page heroes que requieren animación de entrada inicial)
- [ ] `bounce=0` en TODAS las transiciones spring de iconos — sin excepción
- [ ] Animaciones de salida más cortas que las de entrada (≤150ms vs ≥250ms)
- [ ] `prefers-reduced-motion` respetado en TODAS las animaciones
- [ ] CSS transitions para elementos interactivos, keyframes SOLO para
      secuencias one-shot (entrada de página, loading, shimmer)
- [ ] Sin animaciones de propiedades que afectan layout (`width`, `height`,
      `margin`, `padding`, `top`, `left`)
- [ ] Animaciones de UI ≤400ms (WCAG 2.3.1); Corp ≤300ms
- [ ] Canvas animations con `devicePixelRatio` cap (max 2x)
- [ ] Fondos/elementos decorativos con `pointer-events: none`
- [ ] Animaciones de texto preservan contenido completo en `aria-label`
- [ ] Motion en vistas Corp es sutil según tabla §11.4
- [ ] Las clases `corp-card` no tienen `hover:scale-*` adicional
