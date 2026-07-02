# DESIGN_SYSTEM.md — Estándar Visual "Corp"

> **Última actualización:** 2026-06-21
> **Autoridad:** Estándar visual **inmutable** del Frontend. Toda vista de
> "chrome serio" DEBE cumplirlo. Es subordinado a `CLAUDE.md` y `AGENTS.md`,
> pero **autoritativo** sobre cualquier estilo ad-hoc de página.
> **Definiciones CSS:** `frontend/src/index.css` (sección
> `CORPORATE MARKETING SYSTEM` + `CORP SYSTEM — APP / ADMIN PRIMITIVES`).

---

## 0. TL;DR para agentes

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

LittleFounders tiene **dos lenguajes visuales** deliberados:

| Lenguaje | Para quién / dónde | Tipografía | Identidad |
|----------|--------------------|-----------|-----------|
| **Corp** (este doc) | "Chrome serio": marketing, auth, cuenta, dashboards, **admin**, utilitarias, perfil social | Inter (texto) + Sora (títulos) | Limpio, confiable, enterprise, slate + índigo |
| **Playful** (§9) | Experiencia inmersiva de niños: juegos `/games/*`, motor de lecciones inmersivo, celebraciones | Nunito | Lúdico, colorido, gamificado |

> El scope `.corp` existe precisamente para **sacar** un subárbol del Nunito
> lúdico y meterlo al sistema Inter/Sora profesional.

### 1.1 ¿Qué vistas son "Corp"? (alcance inmutable)

**SÍ corp** (deben cumplir este estándar):

- **Marketing:** `LandingPage`, `landing/FamiliesPage`, `landing/HowItWorksPage`,
  `landing/PricingPage`, `landing/FaqPage` + `LandingLayout` / `LandingNavbar` /
  `LandingFooter`. *(Ya migradas — son la referencia.)*
- **Auth / onboarding:** `Login`, `Signup`, `Onboarding`, `PlacementPage`
  (+ `features/placement/*`), `ForgotPassword`, `ResetPassword`, `AuthCallback`,
  `Bye`. *(El flujo `Onboarding`/`Placement` usa la paleta corp + fondo standalone
  (§3.B: `corp-grid-bg`, glow índigo único) + `corp-btn-primary`, pero conserva
  **Nunito** —sin el scope `.corp`— para la calidez del flujo de niños. Es el
  patrón de referencia para esas dos vistas.)*
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

- **Neutros (chrome):** `slate` (`slate-50` … `slate-900`).
- **Marca (primario):** `indigo` / `blue` / `sky`. Gradiente de marca:
  `from-indigo-500 to-blue-500`. Es el acento por defecto para botones, enlaces,
  íconos activos y casi todo el chrome.
- **Acentos categóricos (permitidos, como en las bases):** para diferenciar
  features/categorías en cards de marketing y dashboards se admite un set acotado:
  `violet`/`fuchsia` (p. ej. `from-violet-500 to-fuchsia-500`, usado en los pilares
  de Landing y How-it-works), `emerald`/`teal`, `sky`/`cyan`, `amber`. Úsalos con
  mesura y siempre con su par `dark:`.
- **Semánticos:** `emerald`/`teal` (éxito/seguridad), `amber` (estrellas/monedas),
  `red`/`rose` (peligro), `blue`/`sky` (info).
- **Prohibido (look lúdico viejo):** gradientes multi-stop tipo
  `blue→purple→pink`, acentos **dominados por `pink`/`rose` decorativo**, y los
  sistemas de color "arcoíris" por-ítem. El `pink` rosa de la marca infantil
  anterior NO es corp.
- **Hex dark** (valores raw entre corchetes, úsalos tal cual):
  - Base sección blanca: `dark:bg-[#070b14]`
  - Base sección slate-50: `dark:bg-[#0a0e1a]`
  - Footer profundo: `dark:bg-[#060911]`
  - Superficie flotante/chip: `dark:bg-[#0d1426]`
  - Pill divisor "o": `dark:bg-[#0f1628]`

### 4.2 Texto

| Rol | Light + Dark |
|-----|--------------|
| Título | `text-slate-900 dark:text-white` |
| Cuerpo | `text-slate-600 dark:text-slate-400` (hero: `dark:text-slate-300`) |
| Muted / meta | `text-slate-500 dark:text-slate-400` |
| Acento marca | `text-indigo-600 dark:text-indigo-300` |
| Borde | `border-slate-200 dark:border-white/10` |

### 4.3 Tipografía (escala)

| Elemento | Clases |
|----------|--------|
| H1 hero | `text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.08]` |
| H1 card (auth) | `text-2xl font-bold` |
| H2 sección | `text-3xl md:text-4xl font-bold leading-tight` |
| H3 card | `text-xl font-bold` (denso: `text-lg`) |
| Subtítulo | `text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed` |
| `corp-display` | aplica Sora a un elemento (títulos fuera de h1–h6) |

> **`corp-gradient-text`**: reservado para **UNA** palabra o cifra enfatizada por
> vista. No abusar.

### 4.4 Espaciado, radios, contenedores

- **Contenedores:** ancho amplio `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`;
  copy centrado `max-w-2xl/3xl`; card auth `max-w-sm`.
- **Ritmo vertical:** sección estándar `py-24`; bandas densas `py-14`; hero
  `pt-36 lg:pt-44 pb-20` (compensa navbar fijo).
- **Alternancia de fondo:** secciones alternan `bg-white dark:bg-[#070b14]` ↔
  `bg-slate-50 dark:bg-[#0a0e1a]`.
- **Radios:** botones `rounded-full` (o `rounded-xl` para cards interactivos de opciones); cards principales estilo Isla `rounded-[2.5rem]` (40px);
  CTA grande `rounded-3xl`. **No** uses radios arbitrarios (`rounded-[2rem]`).
- **Alturas botón:** `h-10` (social/inputs), `h-11` (submit auth), `h-12` (CTA card/modal).

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

**DO**
- Usa `corp-*` y la paleta slate+índigo.
- Cada utilidad de color con su `dark:`.
- `t()` en todo texto; `id`/anclas/handlers intactos.
- Mobile-first; iconos `lucide-react`.

**DON'T**
- ❌ `liquid-glass*` / `GlassPanel` en código nuevo (las clases legacy ya renderizan corp; ver §5.1).
- ❌ Gradientes lúdicos viejos: multi-stop `blue→purple→pink`, acentos dominados por `pink`/`rose` decorativo, o sistemas "arcoíris" por-ítem. (Los acentos `violet`/`fuchsia` mesurados de §4.1 SÍ se permiten — las bases los usan.)
- ❌ Títulos `font-black` con gradiente multi-stop.
- ❌ Blobs "ambient glow" decorativos y `corp-grid-bg` (REMOVIDOS a favor del estilo limpio slate-50).
- ❌ Micro-labels `font-black uppercase tracking-widest` → `corp-eyebrow`.
- ❌ `dark:` sobre clases `corp-*` (ya traen su variante).
- ❌ Radios arbitrarios / `backdrop-blur` apilado / `hover:scale-*` bespoke (el hover de `corp-card` ya eleva).
- ❌ Clases Tailwind dinámicas (`bg-${color}-500/10`) que rompen el JIT scan: usa un mapa estático.

---

## 8. Checklist de migración por página

1. ¿Dónde va el scope? (root standalone / `AdminLayout` / wrapper de contenido — §1.2, §2).
2. Fondo → fondo corp (§3) o quitar gradiente lúdico.
3. `GlassPanel`/`liquid-glass` → `corp-card` / `corp-panel` / `corp-panel-subtle`.
4. Botones → `corp-btn-*`. Inputs/Selects → `corp-input` + `corp-label`.
5. Badges → `corp-badge*`. Tablas → `corp-table`. Vacíos → `corp-empty`.
6. Micro-labels y barras de acento → `corp-eyebrow`. Títulos → escala §4.3.
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
- **Tipografía:** Nunito (default `.landing-page-root` / app). Colores vivos
  (índigo/violeta/fucsia/esmeralda/ámbar), gradientes lúdicos, `liquid-glass`
  permitido **sólo aquí**.
- **Sonido:** `useSound()` de `@/contexts/SoundContext`.
- **i18n:** namespace por juego en `i18n/locales/{es,en}/games.json` (o namespace
  dedicado, p. ej. `hackerDefense`).

> **Regla de oro:** una vista o es **Corp** (§1–§8) o es **Playful** (§9). No
> existe una tercera categoría "estilo propio". Si encuentras una vista que no
> cae en ninguna de las dos, es deuda — alinéala a la que corresponda.
