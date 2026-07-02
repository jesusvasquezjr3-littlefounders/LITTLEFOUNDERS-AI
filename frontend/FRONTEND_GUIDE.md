# LittleFounders Frontend

> **Guía técnica completa para contribuidores del frontend.**
> Framework: React 18 + Vite 5 + TypeScript 5.5 + Tailwind CSS 3.4 | Despliegue: Vercel

> ⚠️ **Estilos visuales → `DESIGN_SYSTEM.md`.** Antes de crear o modificar
> cualquier UI, lee [`frontend/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md): es el
> estándar visual **inmutable** ("corp"). Toda vista de chrome serio usa las
> clases `corp-*` (nada de `liquid-glass`/`GlassPanel` ni estilos por página).
> Las vistas de niños (juegos/lecciones) siguen el sub-estándar "Playful".

---

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Routing Completo](#2-routing-completo)
3. [Páginas](#3-páginas)
4. [Componentes Compartidos](#4-componentes-compartidos)
5. [Sistema de Hooks](#5-sistema-de-hooks)
6. [Juegos](#6-juegos)
7. [Lesson Engine](#7-lesson-engine)
8. [Sistema de Auth y Roles](#8-sistema-de-auth-y-roles)
9. [Contextos](#9-contextos)
10. [i18n y Traducciones](#10-i18n-y-traducciones)
11. [Configuración de Build](#11-configuración-de-build)
12. [UI Components (shadcn/ui)](#12-ui-components-shadcnui)
13. [Estado y Data Fetching](#13-estado-y-data-fetching)
14. [Analytics y SEO](#14-analytics-y-seo)
15. [Audio y Sonido](#15-audio-y-sonido)
16. [Convenciones y Patrones](#16-convenciones-y-patrones)
17. [Testing](#17-testing)

---

## 1. Arquitectura General

```
littlefounders.ai
  └── Frontend (React 18 / Vite) → Vercel
  └── Backend (FastAPI) → Railway
  └── DB (PostgreSQL) → Supabase
```

### Jerarquía de Providers (App.tsx, outer → inner)

```
<QueryClientProvider>
  <TooltipProvider>
    <ThemeProvider>
      <SoundProvider>
        <BrowserRouter>
          <LanguageSyncWrapper>
            <AnimatedRoutes>
              <Routes>...</Routes>
            </AnimatedRoutes>
          </LanguageSyncWrapper>
        </BrowserRouter>
      </SoundProvider>
    </ThemeProvider>
  </TooltipProvider>
</QueryClientProvider>
```

### Provider Details

- **QueryClientProvider** — TanStack Query cache global
- **TooltipProvider** — shadcn/ui Radix tooltip context
- **ThemeProvider** — dark/light/system (localStorage key `vite-ui-theme`)
- **SoundProvider** — Howler.js audio context (ver §15)
- **LanguageSyncWrapper** — sincroniza preferencia de idioma con backend al autenticarse
- **AnimatedRoutes** — View Transitions API wrapper

---

## 2. Routing Completo

### 2.1 Rutas Públicas (sin wrapper de auth)

| Path | Component | Notas |
|---|---|---|
| `/` | `LandingPage` | Landing de marketing |
| `/onboarding` | `Onboarding` | Flujo de onboarding invitado |
| `/placement` | `PlacementPage` | Examen de ubicación |
| `/families` | `FamiliesPage` | Subpágina landing |
| `/faq` | `FaqPage` | Preguntas frecuentes |
| `/pricing` | `PricingPage` | Precios |
| `/login` | `Login` | Inicio de sesión |
| `/signup` | `Signup` | Registro |
| `/bye` | `Bye` | Página de despedida |
| `/auth/callback` | `AuthCallback` | Callback OAuth |
| `/forgot-password` | `ForgotPassword` | Solicitud de reseteo |
| `/reset-password` | `ResetPassword` | Confirmación de reseteo |
| `/u/:username` | `UserProfile` | Perfil público social |
| `/lesson/:lessonCode` | `LessonRunner` | Lección dinámica sin wrapper |
| `/investment-games` | `<Navigate to="/games">` | Redirect legacy |
| `/games/nectar-de-las-sombras` | `<Navigate to="/games/nectar-of-shadows">` | Redirect legacy |
| `/lessons` | `<Navigate to="/learn">` | Redirect legacy |

### 2.2 Rutas Protegidas (`ProtectedRoute` — guests allowed por defecto)

| Path | Component |
|---|---|
| `/dashboard` | `Index` |
| `/learn` | `LearnPage` |
| `/games` | `GamesPage` |
| `/profile` | `Profile` |
| `/avatar/edit` | `AvatarEditor` |
| `/settings` | `Settings` |
| `/help` | `Help` |
| `/growth` | `PageUnderConstruction` |
| `/savings` | `PageUnderConstruction` |
| `/store` | `PageUnderConstruction` |
| `/ai` | `PageUnderConstruction` (requireAuth=true) |
| `/games/nam-vs-yum` | `NamVsYumPage` |
| `/games/nectar-of-shadows` | `NectarOfShadowsPage` |
| `/games/paper-detective` | `PaperDetectivePage` |
| `/games/paper-coin` | `PaperCoinPage` |
| `/games/hacker-defense` | `HackerDefensePage` |
| `/games/chronobloom` | `ChronoBloomPage` |

### 2.3 Rutas con Role Guard

| Path | Component | Wrapper |
|---|---|---|
| `/tasks` | `PageUnderConstruction` | `ChildProtectedRoute` |
| `/parent-tasks` | `PageUnderConstruction` | `ParentProtectedRoute` |

### 2.4 Rutas Admin (`AdminProtectedRoute` + `AdminLayout`)

| Path | Component |
|---|---|
| `/admin` | `AdminDashboard` |
| `/admin/lessons` | `AdminLessons` |
| `/admin/lessons/new` | `AdminLessonEditor` |
| `/admin/lessons/:publicId/edit` | `AdminLessonEditor` |
| `/admin/characters` | `AdminCharacters` |
| `/admin/audio` | `AdminAudio` |
| `/admin/history` | `AdminHistory` |
| `/admin/users` | `AdminUsers` |
| `/admin/help` | `AdminHelp` |
| `/admin/reports` | `AdminReports` |
| `/admin/notifications` | `AdminNotifications` |

### 2.5 Catch-All

| Path | Component |
|---|---|
| `*` | `NotFound` (404) |

---

## 3. Páginas

Todas en `src/pages/`. Cada página es un componente de alto nivel renderizado por una ruta.

### 3.1 Páginas de Landing

| Archivo | Descripción |
|---|---|
| `LandingPage.tsx` | Hero, características, CTA principal. Usa `LandingLayout`, `LandingNavbar`, `GamifiedLearningSection`, `CompoundInterestRunner` |
| `FamiliesPage.tsx` | Sección para familias. Usa `BenefitGrid`, `CharacterSection`, `FeatureCard` |
| `FaqPage.tsx` | Preguntas frecuentes |
| `PricingPage.tsx` | Planes y precios |

### 3.2 Páginas de Auth

| Archivo | Descripción |
|---|---|
| `Login.tsx` | Inicio de sesión (email/password, Google, Discord). Usa `AuthLayout` |
| `Signup.tsx` | Registro. Usa `AuthLayout`, `PasswordStrength` |
| `ForgotPassword.tsx` | Solicitud de reseteo de contraseña |
| `ResetPassword.tsx` | Confirmación de reseteo |
| `AuthCallback.tsx` | Maneja redirects OAuth (Google, Discord) |

### 3.3 Páginas de Onboarding

| Archivo | Descripción |
|---|---|
| `Onboarding.tsx` | Flujo de 5 pasos: welcome → name → age → interests → experience |
| `PlacementPage.tsx` | Examen de ubicación. Usa `PlacementEngine`, `PlacementQuestion`, `PlacementProgressBar` |

### 3.4 Páginas de Aprendizaje

| Archivo | Descripción |
|---|---|
| `LearnPage.tsx` | Página principal de aprendizaje con mapa de aventuras |
| `Lessons.tsx` | Página legacy (redirige a `/learn`) |
| `LessonRunner` | Componente dinámico en ruta `/lesson/:lessonCode`. Ver §7 |

### 3.5 Páginas de Dashboard

| Archivo | Descripción |
|---|---|
| `Index.tsx` | Dashboard principal del usuario. Usa `UniversalDashboard` |

### 3.6 Páginas de Juegos

| Archivo | Descripción |
|---|---|
| `GamesPage.tsx` | Catálogo/tablero de juegos disponibles |

### 3.7 Páginas de Usuario

| Archivo | Descripción |
|---|---|
| `Profile.tsx` | Perfil del usuario |
| `AvatarEditor.tsx` | Editor de avatar |
| `Settings.tsx` | Configuración de cuenta |
| `Help.tsx` | Página de ayuda |

### 3.8 Páginas Admin

| Archivo | Descripción |
|---|---|
| `admin/AdminDashboard.tsx` | Dashboard admin con gráficos |
| `admin/AdminLessons.tsx` | CRUD de lecciones |
| `admin/AdminLessonEditor.tsx` | Editor de lección individual |
| `admin/AdminCharacters.tsx` | CRUD de personajes |
| `admin/AdminAudio.tsx` | Gestión de audio |
| `admin/AdminHistory.tsx` | Historial de cambios con rollback |
| `admin/AdminUsers.tsx` | Gestión de usuarios |
| `admin/AdminReports.tsx` | Reportes de feedback |
| `admin/AdminNotifications.tsx` | Notificaciones broadcast |

### 3.9 Otras

| Archivo | Descripción |
|---|---|
| `NotFound.tsx` | Página 404 |
| `PageUnderConstruction.tsx` | Placeholder para rutas no implementadas |
| `Bye.tsx` | Página post-logout |

---

## 4. Componentes Compartidos

### 4.1 Componentes de UI (shadcn/ui)

50+ primitives en `src/components/ui/`. Ver §12 para lista completa.

### 4.2 Componentes de Layout

| Componente | Archivo | Descripción |
|---|---|---|
| `LandingLayout` | `landing/LandingLayout.tsx` | Layout de landing pages |
| `LandingNavbar` | `landing/LandingNavbar.tsx` | Navbar de landing |
| `LandingFooter` | `landing/LandingFooter.tsx` | Footer de landing |
| `DashboardLayout` | `dashboard/DashboardLayout.tsx` | Layout del dashboard |
| `Sidebar` | `dashboard/Sidebar.tsx` | Sidebar del dashboard |
| `TopNav` | `dashboard/TopNav.tsx` | Top nav del dashboard |
| `AdminLayout` | `admin/AdminLayout.tsx` | Layout del admin panel |
| `AdminSidebar` | `admin/AdminSidebar.tsx` | Sidebar del admin |
| `AuthLayout` | `auth/AuthLayout.tsx` | Layout de páginas de auth |

### 4.3 Auth Wrappers

| Componente | Archivo | Uso |
|---|---|---|
| `ProtectedRoute` | `auth/ProtectedRoute.tsx` | Protección general (guests allowed por defecto) |
| `ParentProtectedRoute` | `auth/ParentProtectedRoute.tsx` | Solo usuarios `tutor` |
| `ChildProtectedRoute` | `auth/ChildProtectedRoute.tsx` | Solo usuarios `child` |
| `AdminProtectedRoute` | `admin/AdminProtectedRoute.tsx` | Solo usuarios `admin` |

### 4.4 Componentes de Laoding y Decorativos

| Componente | Archivo |
|---|---|
| `LoadingScreen` | `ui/LoadingScreen.tsx` |
| `AnimatedBackground` | `ui/AnimatedBackground.tsx` |
| `GlassPanel` | `ui/GlassPanel.tsx` |
| `SpeechBubble` | `ui/SpeechBubble.tsx` |
| `LanguageSelector` | `ui/LanguageSelector.tsx` |
| `AssetImg` | `ui/AssetImg.tsx` |
| `StreakCelebration` | `ui/StreakCelebration.tsx` |

### 4.5 Componentes de Dashboard

| Componente | Archivo |
|---|---|
| `UniversalDashboard` | `dashboard/UniversalDashboard.tsx` |
| `ParentDashboard` | `dashboard/ParentDashboard.tsx` |
| `ChildDashboard` | `dashboard/ChildDashboard.tsx` |
| `CustomerAnalytics` | `dashboard/CustomerAnalytics.tsx` |
| `RevenueChart` | `dashboard/RevenueChart.tsx` |
| `KPICard` | `dashboard/KPICard.tsx` |
| `UserTour` | `dashboard/UserTour.tsx` |

### 4.6 Componentes de Lecciones

| Componente | Archivo |
|---|---|
| `Adventures` | `lessons/Adventures.tsx` |
| `AdventureCard` | `lessons/AdventureCard.tsx` |
| `SagaView` | `lessons/SagaView.tsx` |
| `LessonPath` | `lessons/LessonPath.tsx` |
| `TopicNode` | `lessons/TopicNode.tsx` |

### 4.7 Componentes de Personajes

| Componente | Archivo | Expresiones |
|---|---|---|
| `DinoCharacter` | `characters/DinoCharacter.tsx` | `happy`, `excited`, `thinking` |
| `DinaCharacter` | `characters/DinaCharacter.tsx` | `neutral`, `happy`, `surprised`, `wink` |
| `DrRhoCharacter` | `characters/DrRhoCharacter.tsx` | `wise`, `surprised` |
| `ZaraVexCharacter` | `characters/ZaraVexCharacter.tsx` | `excited`, `curious`, `happy` |

### 4.8 Componentes de Landing

| Componente | Archivo |
|---|---|
| `CompoundInterestRunner` | `landing/CompoundInterestRunner.tsx` |
| `EmailWaitlistForm` | `landing/EmailWaitlistForm.tsx` |
| `GamifiedLearningSection` | `landing/GamifiedLearningSection.tsx` |
| `LandingParentCTA` | `landing/LandingParentCTA.tsx` |

### 4.9 Comunes

| Componente | Archivo |
|---|---|
| `ReportFAB` | `common/ReportFAB.tsx` |
| `ReportModal` | `common/ReportModal.tsx` |
| `InDevelopment` | `common/InDevelopment.tsx` |
| `ThemeProvider` | `theme/ThemeProvider.tsx` |
| `ThemeToggle` | `theme/ThemeToggle.tsx` |
| `GuestBanner` | `auth/GuestBanner.tsx` |
| `RegistrationPromptModal` | `auth/RegistrationPromptModal.tsx` |
| `GoogleAnalytics` | `analytics/GoogleAnalytics.tsx` |

---

## 5. Sistema de Hooks

### 5.1 Hooks Generales (`src/hooks/`)

| Hook | Archivo | Retorna |
|---|---|---|
| `useAuth()` | `useAuth.ts` | `{ isAuthenticated, isGuest, isAnonymous, user, guestProfile, displayName, userType, stats, logout, clearAll }` |
| `useLanguage()` | `useLanguage.ts` | `{ currentLanguage, currentLanguageInfo, languages, changeLanguage, isCurrentLanguage }` |
| `useUserLanguage()` | `useUserLanguage.ts` | `{ syncLanguagePreference, saveLanguagePreference, isAuthenticated }` |
| `useIsMobile()` | `use-mobile.tsx` | `boolean` (viewport < 768px) |
| `useToast()` | `use-toast.ts` | `{ toasts, toast, dismiss }` |
| `useAsset(path)` | `useAsset.ts` | `string \| null` (URL resuelta de Supabase Storage) |

### 5.2 Admin Hooks (TanStack Query, `src/hooks/`)

| Hook | Propósito |
|---|---|
| `useAdminLessons()` | CRUD de lecciones |
| `useAdminCharacters()` | CRUD de personajes + gestos |
| `useAdminAudio()` | Upload, generación y borrado de audio |
| `useAdminStats()` | Estadísticas del dashboard admin |
| `useAdminHistory()` | Historial de cambios + rollback |

### 5.3 Lesson Engine Hooks (`src/components/lessons/engine/hooks/`)

| Hook | Archivo | Retorna |
|---|---|---|
| `useLessonData(code)` | `useLessonData.ts` | `{ data, loading, error, completeLesson, fetchNextLessonCode }` |
| `useLessonState(lessonData)` | `useLessonState.ts` | `{ state, currentExerciseIndex, currentExercise, totalExercises, progress, results, startLesson, submitAnswer, nextExercise, retryExercise, pauseLesson, resumeLesson }` |
| `useLessonAudio(exercise, muted, isActive)` | `useLessonAudio.ts` | `{ isNarrativeAudioPlaying, playOnLoad, playFeedback, stopAudio }` |

---

## 6. Juegos

6 juegos standalone en `src/games/`. Cada juego sigue el patrón reducer (gameReducer + types + components).

| Juego | Ruta | Page | Reducer | Estructura |
|---|---|---|---|---|
| **Nam vs Yum** | `/games/nam-vs-yum` | `NamVsYumPage` | `gameReducer.ts` | 20+ componentes, hooks propios (useAchievements, useKeyboardControls, useGameEngine) |
| **Nectar of Shadows** | `/games/nectar-of-shadows` | `NectarOfShadowsPage` | `gameReducer.ts` | Fases: Market → Runner → Stand, UpgradeShop |
| **Paper Detective** | `/games/paper-detective` | `PaperDetectivePage` | `gameReducer.ts` | Fases: Phase1Inspection → Phase2Vault, WardrobeScreen |
| **Paper Coin** | `/games/paper-coin` | `PaperCoinPage` | `gameReducer.ts` | CustomerScene, NumericKeypad, ShopScreen, TimerFuse |
| **Hacker Defense** | `/games/hacker-defense` | `HackerDefensePage` | `gameReducer.ts` | InboxPhase, TowerToolbar, 2FAPrompt, UpgradeMinigame, BossPopup |
| **ChronoBloom** | `/games/chronobloom` | `ChronoBloomPage` | `gameReducer.ts` | PlantToolbar, PonziOverlay, YearResultScreen, PlantInfoPanel |

Cada juego exporta su componente Page desde `index.ts` en su respectiva carpeta (o directamente en App.tsx).

---

## 7. Lesson Engine

### 7.1 Arquitectura

El motor de lecciones es un sistema state-driven que renderiza contenido educativo interactivo. Ubicación: `src/components/lessons/engine/`.

```
lessons/engine/
  index.ts                     -- Re-exporta LessonRunner, hooks, stages
  LessonRunner.tsx              -- Componente principal (1,463 líneas)
  LessonCelebration.tsx         -- Pantalla de celebración post-lección
  hooks/
    index.ts
    useLessonData.ts            -- Fetch de datos de lección
    useLessonState.ts           -- Máquina de estados (951 líneas)
    useLessonAudio.ts           -- Audio narrativo
  stages/
    index.ts
    IntroNarrativeStage.tsx
    MultipleChoiceStage.tsx
  activities/                   -- 40 componentes de actividad
  components/
    PopOptionButton.tsx          -- Botón compartido
```

### 7.2 Máquina de Estados (useLessonState.ts)

```
IDLE ──startLesson()──> PLAYING
                         │
                         v
                    WAITING_INPUT
                         │
                    submitAnswer()
                         │
                         v
                     CHECKING
                         │
                    ┌────┴────┐
                    v         v
            FEEDBACK_SUCCESS  FEEDBACK_ERROR
                    │         │      │
                    │         │  retryExercise()
                    │         │      v
                    │         │  WAITING_INPUT
                    │         │
                    │   nextExercise()
                    │         │
                    └────┬────┘
                         │
                    ┌────┴────┐
                    v         v
              WAITING_INPUT  COMPLETED
```

- **Validación centralizada:** `useLessonState` es la única fuente de verdad para corrección
- **Vidas:** 5 por lección, gestionadas en LessonRunner
- **Soporte:** 50+ tipos de ejercicio con normalizadores para variaciones de schema JSON

### 7.3 Actividades (40 componentes)

### 7.4 Regla de Oro de Layout y Alineación (Centrado Absoluto 0,0 X,Y)

> **REGLA DE ORO DE ALINEACIÓN:** Todos los elementos interactivos y narrativos de una lección (Personaje + Burbuja de diálogo + Tarjetas/Actividades, excluyendo la barra de progreso superior de la lección) DEBEN estar estrictamente centrados en el eje (0,0) (horizontal X y vertical Y) respecto a la pantalla visible disponible.

- **Mobile:** Se apilan en layout vertical (`flex-col`) utilizando `items-center justify-center` en el contenedor `flex-1`.
- **Desktop:** Se distribuyen en dos columnas responsivas (`lg:flex-row`), donde la columna izquierda (`lg:w-1/3`) alberga al personaje con la burbuja de texto, y la columna derecha (`lg:w-2/3`) contiene el componente interactivo. Ambas columnas se alinean mediante `items-center justify-center`.
- **Restricción estricta:** Está estrictamente prohibido usar posiciones `sticky`, paddings superiores asimétricos (`pt-12`, `mt-8`) o alineaciones al tope (`items-start`) en la grilla maestra `LessonRunner` que rompan la simetría bidimensional central.

| Archivo | Exercise Types que renderiza |
|---|---|
| `MultipleChoice.tsx` | `multiple_choice` |
| `TapAction.tsx` | `tap_action` |
| `Classification.tsx` | `classification` |
| `IntroNarrative.tsx` | `intro_narrative` |
| `StoryMode.tsx` | `story_mode` |
| `Sequencing.tsx` | `sequencing` |
| `MatchingPairs.tsx` | `matching_pairs`, `match_pairs` |
| `FillBlank.tsx` | `fill_blank` |
| `TrueFalse.tsx` | `true_false` |
| `MathChallenge.tsx` | `math_challenge` |
| `RoleplayChat.tsx` | `roleplay_chat` |
| `WordScramble.tsx` | `word_scramble` |
| `EstimationSlider.tsx` | `estimation_slider` |
| `RiskReward.tsx` | `risk_reward` |
| `ShopSim.tsx` | `shop_sim` |
| `CoinCounter.tsx` | `coin_counter` |
| `ConceptBuilder.tsx` | `concept_builder` |
| `PriceDetective.tsx` | `price_detective` |
| `SpotTheTrap.tsx` | `spot_trap` |
| `ImpactMeter.tsx` | `impact_meter` |
| `MarketReaction.tsx` | `market_reaction` |
| `MysteryInvestment.tsx` | `mystery_investment` |
| `BudgetBuilder.tsx` | `budget_builder` |
| `SavingsRace.tsx` | `savings_race` |
| `ExpenseTimeline.tsx` | `expense_timeline` |
| `InterestCalculator.tsx` | `interest_calculator` |
| `TaxPuzzle.tsx` | `tax_puzzle` |
| `SubscriptionTracker.tsx` | `subscription_tracker` |
| `InflationSimulator.tsx` | `inflation_simulator` |
| `CreditScoreBuilder.tsx` | `credit_score` |
| `EmergencyFund.tsx` | `emergency_fund` |
| `BillSplitter.tsx` | `bill_splitter` |
| `SalaryComparison.tsx` | `salary_comparison` |
| `DebtStrategy.tsx` | `debt_strategy` |
| `PortfolioBuilder.tsx` | `portfolio_builder` |
| `OpportunityCost.tsx` | `opportunity_cost` |
| `GoalRoadmap.tsx` | `goal_roadmap` |
| `MindsetComparison.tsx` | `mindset_comparison` |
| `PassiveIncome.tsx` | `passive_income` |
| `QuizBattle.tsx` | `quiz_battle` |

---

## 8. Sistema de Auth y Roles

### 8.1 User Types

| Tipo | Descripción | Ruta protegida |
|---|---|---|
| `guest` | Usuario anónimo (localStorage) | Acceso parcial |
| `universal` | Usuario registrado sin rol específico | `ProtectedRoute` |
| `tutor` | Padre/madre/tutor | `ParentProtectedRoute` |
| `child` | Niño/estudiante | `ChildProtectedRoute` |
| `admin` | Administrador | `AdminProtectedRoute` |

### 8.2 Flujo de Autenticación

1. **Onboarding** → usuario anónimo completa onboarding → `GuestProfile` en localStorage
2. **Login/Signup** → JWT almacenado en localStorage (key `token`)
3. **Guest Merge** → al registrarse, POST `/auth/merge-guest` transfiere progreso
4. **Logout** → limpia localStorage + llama a `supabase.auth.signOut()`
5. **Auth Callback** → `/auth/callback` maneja redirects OAuth

### 8.3 Almacenamiento Local

| Key | Contenido |
|---|---|
| `user` | Objeto de usuario (JSON) |
| `token` | JWT (string) |
| `lf_guest_profile` | Perfil de invitado (JSON) |
| `lf_guest_merge_pending` | Datos pendientes de merge (JSON) |

---

## 9. Contextos

| Contexto | Provider | Archivo | Expone |
|---|---|---|---|
| **Sound** | `SoundProvider` | `contexts/SoundContext.tsx` | `playSound(type)`, `playFile(path)`, `playBGM(path)`, `stopBGM()`, `mute`, `toggleMute`, `volume`, `setVolume` |
| **Theme** | `ThemeProvider` | `components/theme/ThemeProvider.tsx` | `theme`, `setTheme` (dark/light/system) |
| **Tooltip** | `TooltipProvider` | Radix UI (shadcn) | Tooltip primitives |
| **React Query** | `QueryClientProvider` | TanStack Query | Cache de queries y mutaciones |

Sound types disponibles: `ui_tap`, `ui_toggle`, `nav_slide`, `auth_success`, `auth_error`, `auth_bye`, `edu_success`, `edu_error`, `edu_complete`, `edu_unlock`.

---

## 10. i18n y Traducciones

Ver documentación completa: `frontend/src/i18n/README.md` (295 líneas).

### Resumen

- **Framework:** i18next + react-i18next + browser-language-detector
- **Idiomas:** `es` (español, activo), `en` (inglés, preparado)
- **Setup:** `src/i18n/index.ts` (inicializado en `main.tsx`)
- **Namespaces disponibles (19):** `common`, `auth`, `landing`, `lessons`, `games`, `admin`, `dashboard`, `avatar`, `settings`, `profile`, `placement`, `reports`, `errors`, `onboarding`, `adventures`, `chronoBloom`, `hackerDefense`

### Convención Obligatoria

```tsx
const { t } = useTranslation(["common", "lessons"]);
t("common:app_name")
t("lessons:learn.page_title")
```

NUNCA hardcodear texto visible en español o inglés.

---

## 11. Configuración de Build

### Vite (`vite.config.ts`)

| Propiedad | Valor |
|---|---|
| Puerto dev | `8080` |
| Host dev | `"::"` (all interfaces) |
| Plugin | `@vitejs/plugin-react-swc` |
| Path alias | `@` → `./src` |

### Dual Build (Query-param i18n)

```typescript
build: {
  rollupOptions: {
    input: {
      main: path.resolve(__dirname, 'index.html'),
      en: path.resolve(__dirname, 'index-en.html'),
    }
  }
}
```

- **`index.html`**: meta tags / OG en español (default)
- **`index-en.html`**: meta tags / OG en inglés, servido vía `?lang=en`
- Vercel rewrites `?lang=en` → `index-en.html`; `es.`/`en.` subdomains → 301 redirect con `?lang=`

### TypeScript Config

| Archivo | strict | Uso |
|---|---|---|
| `tsconfig.app.json` | `true` | Código de la app (`src/`) |
| `tsconfig.node.json` | `true` | Vite config |
| `tsconfig.json` | `false` (overrides) | Solo archivo de referencias |

### Scripts Disponibles

| Script | Comando |
|---|---|
| dev | `npm run dev` |
| build | `npm run build` (`tsc -b && vite build`) |
| lint | `npm run lint` |
| type-check | `npm run type-check` (`tsc --noEmit`) |
| test | `npm test` (`vitest run`) |
| test:watch | `npm run test:watch` |
| preview | `npm run preview` |

---

## 12. UI Components (shadcn/ui)

50+ primitives en `src/components/ui/`. Basados en Radix UI.

| Componente | Archivo |
|---|---|
| Accordion | `accordion.tsx` |
| Alert | `alert.tsx` |
| Alert Dialog | `alert-dialog.tsx` |
| Aspect Ratio | `aspect-ratio.tsx` |
| Avatar | `avatar.tsx` |
| Badge | `badge.tsx` |
| Breadcrumb | `breadcrumb.tsx` |
| Button | `button.tsx` |
| Calendar | `calendar.tsx` |
| Card | `card.tsx` |
| Carousel | `carousel.tsx` |
| Chart | `chart.tsx` |
| Checkbox | `checkbox.tsx` |
| Collapsible | `collapsible.tsx` |
| Command | `command.tsx` |
| Context Menu | `context-menu.tsx` |
| Date Picker | `date-picker.tsx` |
| Dialog | `dialog.tsx` |
| Drawer | `drawer.tsx` |
| Dropdown Menu | `dropdown-menu.tsx` |
| Error Boundary | `error-boundary.tsx` |
| Form | `form.tsx` |
| Hover Card | `hover-card.tsx` |
| Input | `input.tsx` |
| Input OTP | `input-otp.tsx` |
| Label | `label.tsx` |
| Menubar | `menubar.tsx` |
| Navigation Menu | `navigation-menu.tsx` |
| Pagination | `pagination.tsx` |
| Popover | `popover.tsx` |
| Progress | `progress.tsx` |
| Radio Group | `radio-group.tsx` |
| Resizable | `resizable.tsx` |
| Scroll Area | `scroll-area.tsx` |
| Select | `select.tsx` |
| Separator | `separator.tsx` |
| Sheet | `sheet.tsx` |
| Sidebar | `sidebar.tsx` |
| Skeleton | `skeleton.tsx` |
| Slider | `slider.tsx` |
| Sonner | `sonner.tsx` |
| Switch | `switch.tsx` |
| Table | `table.tsx` |
| Tabs | `tabs.tsx` |
| Textarea | `textarea.tsx` |
| Toast / Toaster | `toast.tsx`, `toaster.tsx`, `use-toast.ts` |
| Toggle / Toggle Group | `toggle.tsx`, `toggle-group.tsx` |
| Tooltip | `tooltip.tsx` |

---

## 13. Estado y Data Fetching

### TanStack Query (React Query v5)

- Provider global en `App.tsx`
- Usado principalmente por hooks admin (`useAdmin*`)
- Configuración default (sin custom options)

### Llamadas API

- `API_URL` desde `src/config/api.ts` (VITE_API_URL env var, fallback localhost:8000)
- Endpoints del backend en Railway (`https://littlefounders-backend-production.up.railway.app`)
- **Dev contra backend remoto (sin CORS):** en `frontend/.env.local` definir
  `VITE_API_URL=/api-proxy` y `VITE_DEV_API_PROXY=<url-backend>`. Vite proxea
  `/api-proxy/*` al backend remoto del lado del servidor (ver `vite.config.ts`).

### Almacenamiento Local (Auth)

- `localStorage` para sesión (user, token, guest profile)
- Supabase para auth (sign out, storage URLs)

---

## 14. Analytics y SEO

### Analytics

| Proveedor | ID | Archivo |
|---|---|---|
| Google Analytics 4 | `G-0XH7S80QG2` | `index.html` (gtag), `analytics/GoogleAnalytics.tsx` (page views) |
| Microsoft Clarity | `vwvchxd933` | `index.html` |
| Vercel Analytics | automático | `App.tsx` → `<Analytics />` |

Eventos custom: `frontend/src/lib/analytics.ts` → `trackEvent(name, params?)`. No-op en localhost.

### SEO

- JSON-LD Schema (`WebSite` + `EducationalOrganization`) en `index.html` e `index-en.html`
- Sitemap hreflang para ES/EN
- Preloads LCP, lazy loading de imágenes
- Meta tags diferenciados por idioma (dual build, ver §11)

---

## 15. Audio y Sonido

### SoundContext (`contexts/SoundContext.tsx`)

Usa Howler.js para gestión de audio.

**API expuesta:**
- `playSound(type)` — reproduce sonido predefinido por tipo
- `playFile(path)` — reproduce archivo de audio arbitrario
- `playBGM(path)` — inicia background music con fade in
- `stopBGM()` / `pauseBGM()` / `resumeBGM()` — control de BGM
- `mute`, `toggleMute`, `volume`, `setVolume` — control de estado

**Sound types:** `ui_tap`, `ui_toggle`, `nav_slide`, `auth_success`, `auth_error`, `auth_bye`, `edu_success`, `edu_error`, `edu_complete`, `edu_unlock`

**Assets de audio:** `public/sounds/{ui,edu,auth,onboarding}/`

### Audio Narrativo (Lesson Engine)

Hook `useLessonAudio()` maneja playback de narración por ejercicio con:
- `playOnLoad()` — reproduce narración al cargar ejercicio
- `playFeedback(isCorrect)` — reproduce feedback acertar/fallar
- `stopAudio()` — detiene reproducción actual

---

## 16. Convenciones y Patrones

### Código

| Regla | Detalle |
|---|---|
| Mobile-first | Clases base para móvil, `sm:`, `lg:` para desktop |
| i18n obligatorio | Todo texto visible por `t()` |
| Sin any | Tipos concretos; justificar excepciones |
| strict: true | TypeScript strict mode activado |
| Tailwind utility | Sin valores raw hex/pixel |
| Sin Prettier | Formateo vía ESLint |
| Path alias | `@/` → `src/` para todos los imports internos |
| CVA | `class-variance-authority` para variantes de componentes |
| cn() | `clsx` + `tailwind-merge` en `src/lib/utils.ts` |

### Diseño y Estilos (Corp Standard)

Todo el proyecto sigue un estándar unificado (índigo/white frosted glass):
- **Fondos globales:** `bg-gradient-to-b from-indigo-50/80 via-white to-white` + `<div className="absolute inset-0 corp-grid-bg pointer-events-none" />`.
- **Paneles y formularios:** Usar exclusivamente la clase `corp-card` para asegurar las transparencias consistentes (no blurs customizados aleatorios).
- **Botones principales:** Usar `corp-btn-primary`.
- **Componentes de Auth/Onboarding:** Ya implementan este layout exacto. No crear diseños aislados sin antes ajustarse a la línea visual principal.

### Estructura de Archivos

- Cada feature en su directorio dentro de `src/`
- Juegos en `src/games/{nombre}/` con reducer, types, constants, components
- Actividades del lesson engine en `src/components/lessons/engine/activities/`
- Componentes reutilizables en `src/components/ui/` (shadcn) o sus subdirectorios

### Skills de Diseño para Agentes AI (Frontend)

Al trabajar en UI Frontend, los agentes AI **deben** invocar las skills especializadas del proyecto (ver `CLAUDE.md` §4 para el catálogo completo):

| Skill | Cuándo usarla | Flujo de trabajo |
|-------|--------------|-----------------|
| **agave** | Al crear, revisar o modificar cualquier UI | Invocar antes de generar código UI para aplicar principios de jerarquía visual, color con intención, tipografía estructural y restricción |
| **emil-design-eng** | Al escribir animaciones o tomar decisiones de motion | Invocar al construir interfaces animadas; cubre easing, timing, springs, clip-path, performance de animaciones |
| **impeccable** | Al diseñar, rediseñar, auditar o pulir interfaces | Usar subcomandos: `craft`/`shape` (diseño nuevo), `audit`/`polish` (calidad), `animate`/`delight` (mejoras), `harden` (producción) |
| **review-animations** | Al revisar código de animación/motion existente | Invocar **solo** para review de CSS/JS de motion; no para review general |

**Regla clave:** Las skills complementan el `DESIGN_SYSTEM.md` — no lo reemplazan. Las skills refinan la ejecución; el design system define los tokens y clases `corp-*`.

---

## 17. Testing

### Framework

- **Vitest** con jsdom
- **@testing-library/react** + **@testing-library/jest-dom**
- Config: `vitest.config.ts` con alias `@/` resuelto

### Comandos

```bash
npm test             # vitest run (una vez)
npm run test:watch   # modo watch
```

### Estado Actual

- Tests placeholder en `src/__tests__/`
- Sin tests reales implementados (deuda técnica conocida)

---

> **Última actualización:** 2026-06-21
> **Idioma:** Español
