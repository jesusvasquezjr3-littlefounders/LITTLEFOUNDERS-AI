# repo_map.md — LittleFounders AI Repository Map

> **Generado por:** `scripts/generate_repo_map.py`  
> **Propósito:** Índice completo del repositorio con firma de cada archivo de código.
> Cada archivo muestra las primeras 15 líneas (imports, clases, funciones).
> **Instrucción para agentes AI:** Este archivo es el punto de entrada.
> Ubica la ruta que necesitas y luego lee el archivo completo con la herramienta `Read`.

---

## Directorio

```
LITTLEFOUNDERS-AI/
    package-lock.json
    package.json
    vercel.json
    frontend/
        components.json
        eslint.config.js
        index-en.html
        index.html
        package-lock.json
        package.json
        postcss.config.js
        tailwind.config.ts
        tsconfig.app.json
        tsconfig.json
        tsconfig.node.json
        vite.config.ts
        vitest.config.ts
        public/
            video/
            sounds/
                edu/
                ui/
                auth/
                onboarding/
                    ES/
                    EN/
        src/
            App.css
            App.tsx
            index.css
            lottie.d.ts
            main.tsx
            vite-env.d.ts
            contexts/
                SoundContext.tsx
            config/
                api.ts
            features/
                placement/
                    PlacementEngine.tsx
                    types.ts
                    bank/
                        items.ts
                    components/
                        PlacementClosingScreen.tsx
                        PlacementIntroScreen.tsx
                        PlacementProgressBar.tsx
                        PlacementQuestion.tsx
                    scoring/
                        engine.ts
            utils/
                accountSync.ts
                errorUtils.ts
                gestureMapper.ts
            components/
                ui/
                    AssetImg.tsx
                    LanguageSelector.tsx
                    LoadingScreen.tsx
                    SpeechBubble.tsx
                    StreakCelebration.tsx
                    accordion.tsx
                    alert-dialog.tsx
                    alert.tsx
                    aspect-ratio.tsx
                    avatar.tsx
                    badge.tsx
                    breadcrumb.tsx
                    button.tsx
                    calendar.tsx
                    card.tsx
                    carousel.tsx
                    chart.tsx
                    checkbox.tsx
                    collapsible.tsx
                    command.tsx
                    context-menu.tsx
                    date-picker.tsx
                    dialog.tsx
                    drawer.tsx
                    dropdown-menu.tsx
                    error-boundary.tsx
                    form.tsx
                    hover-card.tsx
                    input-otp.tsx
                    input.tsx
                    label.tsx
                    menubar.tsx
                    navigation-menu.tsx
                    pagination.tsx
                    popover.tsx
                    progress.tsx
                    radio-group.tsx
                    resizable.tsx
                    scroll-area.tsx
                    select.tsx
                    separator.tsx
                    sheet.tsx
                    sidebar.tsx
                    skeleton.tsx
                    slider.tsx
                    sonner.tsx
                    switch.tsx
                    table.tsx
                    tabs.tsx
                    textarea.tsx
                    toast.tsx
                    toaster.tsx
                    toggle-group.tsx
                    toggle.tsx
                    tooltip.tsx
                    use-toast.ts
                landing/
                    CompoundInterestRunner.tsx
                    EmailWaitlistForm.tsx
                    GamifiedLearningSection.tsx
                    LandingFooter.tsx
                    LandingLayout.tsx
                    LandingNavbar.tsx
                    LandingParentCTA.tsx
                    LiquidGlassMedia.tsx
                    Reveal.tsx
                    StockImage.tsx
                showreel/
                    ShowreelComposition.tsx
                    ShowreelPlayer.tsx
                auth/
                    AuthLayout.tsx
                    ChildProtectedRoute.tsx
                    GuestBanner.tsx
                    GuestNudgeModal.tsx
                    LanguageSyncWrapper.tsx
                    ParentProtectedRoute.tsx
                    PasswordStrength.tsx
                    ProtectedRoute.tsx
                admin/
                    AdminActivityChart.tsx
                    AdminContributionGraph.tsx
                    AdminLayout.tsx
                    AdminNotificationBell.tsx
                    AdminProtectedRoute.tsx
                    AdminSidebar.tsx
                    ExerciseEditorForms.tsx
                    ExerciseEditorModal.tsx
                    ExercisePreview.tsx
                    utils/
                        transformToTimeline.ts
                animation/
                dashboard/
                    CustomerAnalytics.tsx
                    DashboardLayout.tsx
                    KPICard.tsx
                    ParentDashboard.tsx
                    RevenueChart.tsx
                    Sidebar.tsx
                    TopNav.tsx
                    UserTour.tsx
                social/
                    UserConnectionsList.tsx
                common/
                    ReportFAB.tsx
                    ReportModal.tsx
                theme/
                    ThemeProvider.tsx
                    ThemeToggle.tsx
                avatar/
                    AvatarDisplay.tsx
                lessons/
                    AdventureCard.tsx
                    Adventures.tsx
                    LessonPath.tsx
                    SagaView.tsx
                    TopicNode.tsx
                    hooks/
                        useAdventures.ts
                        useLessonsList.ts
                        useResumeLesson.ts
                        useSagaData.ts
                    engine/
                        LessonCelebration.tsx
                        LessonRunner.tsx
                        index.ts
                        ui/
                            CoinBurst.tsx
                            OptionCard.tsx
                            QuestButton.tsx
                            QuestProgress.tsx
                            motion.ts
                        stages/
                            IntroNarrativeStage.tsx
                            MultipleChoiceStage.tsx
                            index.ts
                        components/
                            PopOptionButton.tsx
                        hooks/
                            index.ts
                            useLessonAudio.ts
                            useLessonData.ts
                            useLessonState.ts
                        activities/
                            BillSplitter.tsx
                            BudgetBuilder.tsx
                            Classification.tsx
                            CoinCounter.tsx
                            ConceptBuilder.tsx
                            CreditScoreBuilder.tsx
                            DebtStrategy.tsx
                            EmergencyFund.tsx
                            EstimationSlider.tsx
                            ExpenseTimeline.tsx
                            FillBlank.tsx
                            GenericChoice.tsx
                            GoalRoadmap.tsx
                            ImpactMeter.tsx
                            InflationSimulator.tsx
                            InterestCalculator.tsx
                            IntroNarrative.tsx
                            MarketReaction.tsx
                            MatchingPairs.tsx
                            MathChallenge.tsx
                            MindsetComparison.tsx
                            MultipleChoice.tsx
                            MysteryInvestment.tsx
                            OpportunityCost.tsx
                            PassiveIncome.tsx
                            PortfolioBuilder.tsx
                            PriceDetective.tsx
                            QuizBattle.tsx
                            RiskReward.tsx
                            RoleplayChat.tsx
                            SalaryComparison.tsx
                            SavingsRace.tsx
                            Sequencing.tsx
                            ShopSim.tsx
                            SpotTheTrap.tsx
                            StoryMode.tsx
                            SubscriptionTracker.tsx
                            TapAction.tsx
                            TaxPuzzle.tsx
                            TrueFalse.tsx
                            WordScramble.tsx
                            optionSource.ts
                routing/
                transitions/
                    AnimatedRoutes.tsx
                characters/
                    DinaCharacter.tsx
                    DinoCharacter.tsx
                    DrRhoCharacter.tsx
                    ZaraVexCharacter.tsx
                analytics/
                    GoogleAnalytics.tsx
                families/
                    BenefitGrid.tsx
                    CharacterSection.tsx
                    FeatureCard.tsx
            __tests__/
                lessonEngine.test.ts
                optionSource.test.ts
                placeholder.test.ts
                setup.ts
                useAdminAlerts.test.tsx
                useAdminSettings.test.ts
                validateAnswer.corpus.test.ts
                validateAnswer.test.ts
            hooks/
                use-mobile.tsx
                use-toast.ts
                useAdminAlerts.ts
                useAdminAudio.ts
                useAdminCharacters.ts
                useAdminHistory.ts
                useAdminLessons.ts
                useAdminSettings.ts
                useAdminStats.ts
                useAsset.ts
                useAuth.ts
                useLanguage.ts
                useScrollReveal.ts
                useUserLanguage.ts
            lib/
                analytics.ts
                assets.ts
                guestProfile.ts
                streakUtils.ts
                supabase.ts
                utils.ts
                api/
                    notifications.ts
                    social.ts
            i18n/
                index.ts
                locales/
                    pt/
                    fr/
                    es/
                    en/
            pages/
                AuthCallback.tsx
                AvatarEditor.tsx
                Bye.tsx
                ForgotPassword.tsx
                GamesPage.tsx
                Help.tsx
                Index.tsx
                LandingPage.tsx
                LearnPage.tsx
                Login.tsx
                NotFound.tsx
                Onboarding.tsx
                PageUnderConstruction.tsx
                PlacementPage.tsx
                Profile.tsx
                ResetPassword.tsx
                Settings.tsx
                Signup.tsx
                landing/
                    FamiliesPage.tsx
                    FaqPage.tsx
                    HowItWorksPage.tsx
                    PricingPage.tsx
                admin/
                    AdminAnalytics.tsx
                    AdminAudio.tsx
                    AdminCharacters.tsx
                    AdminDashboard.tsx
                    AdminHelp.tsx
                    AdminHistory.tsx
                    AdminLessonEditor.tsx
                    AdminLessons.tsx
                    AdminNotifications.tsx
                    AdminReports.tsx
                    AdminSettings.tsx
                    AdminUsers.tsx
                social/
                    UserProfile.tsx
                dev/
                    LessonLab.tsx
            games/
                paper-coin/
                    PaperCoinPage.tsx
                    constants.ts
                    gameReducer.ts
                    index.ts
                    paper-coin.css
                    types.ts
                    components/
                        CustomerScene.tsx
                        FeedbackOverlay.tsx
                        GameHUD.tsx
                        GameOverScreen.tsx
                        GameStartScreen.tsx
                        NumericKeypad.tsx
                        PaperCoinGame.tsx
                        PauseOverlay.tsx
                        ShopScreen.tsx
                        TimerFuse.tsx
                        TutorialOverlay.tsx
                paper-detective/
                    PaperDetectivePage.tsx
                    constants.ts
                    gameReducer.ts
                    paper-detective.css
                    types.ts
                    components/
                        GameHUD.tsx
                        GameOverScreen.tsx
                        GameStartScreen.tsx
                        PaperDetectiveGame.tsx
                        PauseOverlay.tsx
                        Phase1Inspection.tsx
                        Phase2Vault.tsx
                        TutorialOverlay.tsx
                        WardrobeScreen.tsx
                nectar-of-shadows/
                    NectarOfShadowsPage.tsx
                    constants.ts
                    gameReducer.ts
                    nectar-of-shadows.css
                    types.ts
                    components/
                        DaySummary.tsx
                        GameOverScreen.tsx
                        GameStartScreen.tsx
                        MarketPhase.tsx
                        MentorPopup.tsx
                        NectarGame.tsx
                        PauseOverlay.tsx
                        RunnerPhase.tsx
                        StandPhase.tsx
                        TutorialOverlay.tsx
                        UpgradeShop.tsx
                chronobloom/
                    ChronoBloomPage.tsx
                    chronobloom.css
                    constants.ts
                    gameReducer.ts
                    index.ts
                    types.ts
                    components/
                        ChronoBloomGame.tsx
                        GameCanvas.tsx
                        GameHUD.tsx
                        GameOverScreen.tsx
                        GameStartScreen.tsx
                        LevelCompleteScreen.tsx
                        PauseOverlay.tsx
                        PlantInfoPanel.tsx
                        PlantToolbar.tsx
                        PonziOverlay.tsx
                        TutorialOverlay.tsx
                        VictoryScreen.tsx
                        YearResultScreen.tsx
                nam-vs-yum/
                    NamVsYumPage.tsx
                    constants.ts
                    gameReducer.ts
                    index.ts
                    nam-vs-yum.css
                    types.ts
                    useGameEngine.ts
                    components/
                        AchievementGallery.tsx
                        AchievementPopup.tsx
                        BombTimer.tsx
                        FallingItem.tsx
                        FloatingText.tsx
                        FrenzyBar.tsx
                        GameHUD.tsx
                        GameOverScreen.tsx
                        GameStartScreen.tsx
                        LeaderboardScreen.tsx
                        LevelCompleteScreen.tsx
                        MentorPopup.tsx
                        Monster.tsx
                        MonsterShop.tsx
                        NamVsYumGame.tsx
                        ParticleSystem.tsx
                        PauseOverlay.tsx
                        PowerUpIndicator.tsx
                        StatsScreen.tsx
                        TrashZone.tsx
                        TutorialOverlay.tsx
                        WeatherOverlay.tsx
                    hooks/
                        useAchievements.ts
                        useFullscreen.ts
                        useKeyboardControls.ts
                        usePlayerProgress.ts
                hacker-defense/
                    HackerDefensePage.tsx
                    constants.ts
                    gameReducer.ts
                    hacker-defense.css
                    index.ts
                    types.ts
                    components/
                        BossPopupOverlay.tsx
                        GameHUD.tsx
                        GameMap.tsx
                        GameOverScreen.tsx
                        GameStartScreen.tsx
                        HackerDefenseGame.tsx
                        InboxPhase.tsx
                        LevelResult.tsx
                        PauseOverlay.tsx
                        TowerToolbar.tsx
                        TutorialOverlay.tsx
                        TwoFAPrompt.tsx
                        UpgradeMinigame.tsx
    backend/
        __init__.py
        config.py
        database.py
        main.py
        models.py
        nixpacks.toml
        pyproject.toml
        railway.json
        schemas.py
        audio_factory/
            config.py
            db_client.py
            extractor.py
            generate_module.py
            main.py
            migrate_to_r2.py
            storage_client.py
            test_all_voices.py
            test_voice.py
            tts_client.py
            voice_registry.py
            voice_samples/
            cache/
                voice_ids.json
            test_outputs/
        lesson_factory/
            generate.py
            pedagogy_rules.json
            validate.py
            curriculum/
                adventure_1.json
                adventure_2.json
                adventure_3.json
                adventure_4.json
                adventure_5.json
                adventure_6.json
        auth/
            __init__.py
            endpoints.py
            permissions.py
            schemas.py
            utils.py
        lesson_engine/
            __init__.py
            endpoints.py
            littlefounders_lessons/
                adventure_2/
                    saga_4/
                        topic_34/
                        topic_33/
                        topic_32/
                        topic_35/
                        topic_28/
                        topic_29/
                        topic_30/
                        topic_31/
                    saga_3/
                        topic_19/
                        topic_26/
                        topic_21/
                        topic_20/
                        topic_27/
                        topic_22/
                        topic_25/
                        topic_24/
                        topic_23/
                    saga_2/
                        topic_17/
                        topic_10/
                        topic_11/
                        topic_16/
                        topic_18/
                        topic_13/
                        topic_14/
                        topic_15/
                        topic_12/
                    saga_5/
                        topic_43/
                        topic_42/
                        topic_39/
                        topic_37/
                        topic_36/
                        topic_38/
                        topic_40/
                        topic_41/
                    saga_1/
                        topic_2/
                        topic_5/
                        topic_4/
                        topic_3/
                        topic_8/
                        topic_6/
                        topic_1/
                        topic_7/
                        topic_9/
                adventure_5/
                    saga_4/
                        topic_26/
                        topic_28/
                        topic_29/
                        topic_27/
                        topic_25/
                        topic_24/
                        topic_23/
                    saga_3/
                        topic_19/
                        topic_21/
                        topic_17/
                        topic_16/
                        topic_20/
                        topic_18/
                        topic_22/
                    saga_2/
                        topic_10/
                        topic_11/
                        topic_9/
                        topic_13/
                        topic_14/
                        topic_15/
                        topic_12/
                    saga_5/
                        topic_34/
                        topic_33/
                        topic_32/
                        topic_35/
                        topic_30/
                        topic_36/
                        topic_31/
                    saga_6/
                        topic_42/
                        topic_39/
                        topic_37/
                        topic_38/
                        topic_40/
                        topic_41/
                    saga_1/
                        topic_2/
                        topic_5/
                        topic_4/
                        topic_3/
                        topic_8/
                        topic_6/
                        topic_1/
                        topic_7/
                adventure_4/
                    saga_4/
                        topic_26/
                        topic_28/
                        topic_29/
                        topic_27/
                        topic_30/
                        topic_25/
                        topic_24/
                    saga_3/
                        topic_19/
                        topic_21/
                        topic_17/
                        topic_20/
                        topic_18/
                        topic_22/
                        topic_23/
                    saga_2/
                        topic_10/
                        topic_11/
                        topic_16/
                        topic_9/
                        topic_13/
                        topic_14/
                        topic_15/
                        topic_12/
                    saga_5/
                        topic_34/
                        topic_33/
                        topic_32/
                        topic_35/
                        topic_36/
                        topic_31/
                    saga_1/
                        topic_2/
                        topic_5/
                        topic_4/
                        topic_3/
                        topic_8/
                        topic_6/
                        topic_1/
                        topic_7/
                adventure_3/
                    saga_4/
                        topic_26/
                        topic_28/
                        topic_27/
                        topic_25/
                        topic_24/
                        topic_23/
                    saga_3/
                        topic_19/
                        topic_21/
                        topic_17/
                        topic_16/
                        topic_20/
                        topic_18/
                        topic_22/
                    saga_2/
                        topic_10/
                        topic_11/
                        topic_9/
                        topic_13/
                        topic_14/
                        topic_15/
                        topic_12/
                    saga_5/
                        topic_34/
                        topic_33/
                        topic_32/
                        topic_35/
                        topic_29/
                        topic_30/
                        topic_31/
                    saga_1/
                        topic_2/
                        topic_5/
                        topic_4/
                        topic_3/
                        topic_8/
                        topic_6/
                        topic_1/
                        topic_7/
                adventure_6/
                    saga_4/
                        topic_21/
                        topic_20/
                        topic_22/
                        topic_25/
                        topic_24/
                        topic_23/
                    saga_3/
                        topic_19/
                        topic_17/
                        topic_16/
                        topic_18/
                        topic_13/
                        topic_14/
                        topic_15/
                    saga_2/
                        topic_10/
                        topic_11/
                        topic_8/
                        topic_7/
                        topic_9/
                        topic_12/
                    saga_5/
                        topic_26/
                        topic_28/
                        topic_29/
                        topic_27/
                        topic_30/
                        topic_31/
                    saga_6/
                        topic_34/
                        topic_33/
                        topic_32/
                        topic_35/
                        topic_37/
                        topic_36/
                        topic_38/
                    saga_1/
                        topic_2/
                        topic_5/
                        topic_4/
                        topic_3/
                        topic_6/
                        topic_1/
                adventure_1/
                    saga_4/
                        topic_34/
                        topic_33/
                        topic_32/
                        topic_35/
                        topic_43/
                        topic_42/
                        topic_39/
                        topic_37/
                        topic_36/
                        topic_38/
                        topic_40/
                        topic_41/
                    saga_3/
                        topic_26/
                        topic_28/
                        topic_29/
                        topic_27/
                        topic_30/
                        topic_31/
                        topic_22/
                        topic_25/
                        topic_24/
                        topic_23/
                    saga_2/
                        topic_19/
                        topic_21/
                        topic_17/
                        topic_16/
                        topic_20/
                        topic_18/
                        topic_13/
                        topic_14/
                        topic_15/
                        topic_12/
                    saga_5/
                        topic_51/
                        topic_50/
                        topic_44/
                        topic_45/
                        topic_47/
                        topic_49/
                        topic_48/
                        topic_46/
                    saga_1/
                        topic_2/
                        topic_5/
                        topic_4/
                        topic_3/
                        topic_10/
                        topic_11/
                        topic_8/
                        topic_6/
                        topic_1/
                        topic_7/
                        topic_9/
                debug/
        tests/
            __init__.py
            conftest.py
            test_health.py
        admin/
            __init__.py
            endpoints.py
            error_messages.py
            permissions.py
            schemas.py
            services.py
            validators.py
        utils/
            gesture_mapper.py
            limiter.py
        dashboard/
            __init__.py
            endpoints.py
        social/
            __init__.py
            endpoints.py
            schemas.py
        scripts/
            __init__.py
            clear_all_lessons.py
            create_verification_lessons.py
            generate_audio.py
            image_generator.py
            import_lessons.py
            lf_audio_client.py
            list_models.py
            restructure_db.py
            test_schema_serialization.py
            verify_all_lessons.py
            verify_api_data.py
        i18n/
            __init__.py
            messages.py
        assets/
            __init__.py
            endpoints.py
        notifications/
            __init__.py
            endpoints.py
            helpers.py
            schemas.py
        reports/
            __init__.py
            endpoints.py
            schemas.py
    supabase/
        config.toml
        functions/
            verify-password/
                index.ts
    scripts/
        generate_repo_map.py
    .github/
        workflows/
            backend-ci.yml
            cd.yml
            frontend-ci.yml
        skills/
            impeccable/
                scripts/
                    detector/
                        shared/
                        cli/
                        browser/
                            injected/
                        profile/
                        engines/
                            regex/
                            browser/
                            visual/
                            static-html/
                        registry/
                        rules/
                        node/
                    live/
                    lib/
                reference/
    api/
        index.py
    .vscode/
        settings.json
```

---

## Archivos de Código (primeras 15 líneas cada uno)

**456 archivos de código** + **23 archivos de configuración**

### `.github/workflows/backend-ci.yml` (Config)

```yaml
name: Backend CI
on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - "!backend/**/*.md"   # cambios solo-docs no gatillan CI/CD del backend
      - ".github/workflows/backend-ci.yml"
  pull_request:
    paths:
      - "backend/**"
      - "!backend/**/*.md"
      - ".github/workflows/backend-ci.yml"

jobs:
```

### `.github/workflows/cd.yml` (Config)

```yaml
name: CD — Deploy
on:
  workflow_run:
    workflows: ["Frontend CI", "Backend CI"]
    types: [completed]
    branches: [main]

jobs:
  deploy-vercel:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    name: Trigger Vercel Deploy
    runs-on: ubuntu-latest
    steps:
      - name: Deploy webhook
        run: |
```

### `.github/workflows/frontend-ci.yml` (Config)

```yaml
name: Frontend CI
on:
  push:
    branches: [main]
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"
  pull_request:
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"

jobs:
  test:
    name: type-check + lint + test + build
```

### `.vscode/settings.json` (Config)

```json
{
  "css.lint.unknownAtRules": "ignore",
  "deno.enable": true,
  "deno.enablePaths": [
    "supabase/functions"
  ]
}
```

### `api/index.py` (Code)

```python
import sys
import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Add backend directory to Python path so we can import from it
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)

# Try to import the main app, catch any errors for debugging
try:
    from main import app as application
    app = application
except Exception as e:
    # If the main app fails to import, create a minimal app that returns the error
```

### `backend/__init__.py` (Code)

```python

```

### `backend/admin/__init__.py` (Code)

```python
# Admin Panel Module
```

### `backend/admin/endpoints.py` (Code)

```python
"""
backend/admin/endpoints.py
Todos los endpoints del admin panel, protegidos por require_admin.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import Date, String, asc, cast, desc, func
from sqlalchemy.orm import Session

```

### `backend/admin/error_messages.py` (Code)

```python
"""
backend/admin/error_messages.py
Utilidad para formatear errores de validación de manera bilingüe.
"""
from __future__ import annotations

from typing import Any


def format_validation_error_response(errors_es: list[str], errors_en: list[str]) -> dict[str, Any]:
    """
    Formatea errores de validación de ejercicios en ambos idiomas.

    Args:
        errors_es: Lista de errores en español
```

### `backend/admin/permissions.py` (Code)

```python
"""
backend/admin/permissions.py
Dependency de FastAPI que restringe acceso solo a usuarios ADMIN.
"""
from fastapi import Depends, HTTPException, status

from auth.endpoints import get_current_user_from_token
from models import User, UserType


async def require_admin(
    current_user: User = Depends(get_current_user_from_token),
) -> User:
    """
    Dependency que verifica que el usuario autenticado sea ADMIN.
```

### `backend/admin/schemas.py` (Code)

```python
"""
backend/admin/schemas.py
Schemas para request/response de todos los endpoints admin.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ──── LECCIONES ────

class LessonMetadataUpdate(BaseModel):
    """Para crear o actualizar metadata de una lección."""
```

### `backend/admin/services.py` (Code)

```python
"""
backend/admin/services.py
Lógica para registrar automáticamente cada cambio en el historial.
"""
from sqlalchemy.orm import Session

from models import Character, CharacterGesture, ContentEditHistory, Lesson


def record_edit(
    db: Session,
    editor_user_id: int,
    entity_type: str,
    entity_id: int,
    entity_public_id: str = None,
```

### `backend/admin/validators.py` (Code)

```python
"""
backend/admin/validators.py
Validadores JSON por tipo de ejercicio.
Aseguran que la estructura de cada ejercicio sea compatible con el LessonRunner.
"""
from __future__ import annotations

# Los 40 tipos válidos de ejercicio
VALID_EXERCISE_TYPES = [
    # Grupo 1 — Fundación (11 tipos)
    "intro_narrative", "multiple_choice", "true_false", "fill_blank",
    "classification", "matching_pairs", "sequencing", "tap_action",
    "story_mode", "math_challenge", "word_scramble",
    # Grupo 2 — Interactivos (5 tipos)
    "roleplay_chat", "estimation_slider", "risk_reward",
```

### `backend/assets/__init__.py` (Code)

```python

```

### `backend/assets/endpoints.py` (Code)

```python
"""
Assets proxy endpoints — generates signed URLs for game-assets bucket.
Accessible by authenticated AND anonymous (guest) users.
Rate-limited to prevent abuse.
"""
import time
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Request, status
from supabase import create_client

from config import settings

router = APIRouter(prefix="/assets", tags=["Assets"])

```

### `backend/audio_factory/cache/voice_ids.json` (Config)

```json
{
  "liruf_es": "qwen-tts-vc-liruf_es-voice-20260511010205932-28d9",
  "dina_es": "qwen-tts-vc-dina_es-voice-20260511010211903-b991",
  "dr_rho_es": "qwen-tts-vc-dr_rho_es-voice-20260511010222133-d6a7",
  "zara_vex_es": "qwen-tts-vc-zara_vex_es-voice-20260511010229014-3ebb",
  "liruf_en": "qwen-tts-vc-liruf_en-voice-20260511011342975-3229",
  "dina_en": "qwen-tts-vc-dina_en-voice-20260511011349938-f040",
  "dr_rho_en": "qwen-tts-vc-dr_rho_en-voice-20260511011355791-b9e6",
  "zara_vex_en": "qwen-tts-vc-zara_vex_en-voice-20260511011404046-609d"
}
```

### `backend/audio_factory/config.py` (Code)

```python
"""
config.py — Carga y valida todas las variables de entorno del audio_factory.
Importar este módulo antes que cualquier otro en el factory.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Cargar .env desde la misma carpeta que este archivo
_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)
```

### `backend/audio_factory/db_client.py` (Code)

```python
"""
db_client.py — Registra los segmentos de audio en la tabla lesson_audio_segments
via Supabase client (no requiere DATABASE_URL directo).

Estrategia de upsert:
  1. Busca registro existente por (lesson_id, exercise_id, target_field, language_code).
  2. Si existe → actualiza (audio_url, transcript, duration_ms, character_id, is_active).
  3. Si no existe → inserta nuevo registro.
"""
from __future__ import annotations

import hashlib

from supabase import Client, create_client

```

### `backend/audio_factory/extractor.py` (Code)

```python
"""
extractor.py — Extrae los fragmentos de texto a narrar de un ejercicio.

Usa DeepSeek para analizar el JSON del ejercicio y determinar qué texto
corresponde a cada target_field, sin inventar contenido nuevo.

Los campos de feedback (success/error) se extraen directamente del JSON
sin pasar por DeepSeek (siempre están en exercise.feedback.success/error).
"""

import json

from openai import OpenAI

import config
```

### `backend/audio_factory/generate_module.py` (Code)

```python
"""
generate_module.py — Genera audios para todas las lecciones de un módulo (adventure).

Ventajas sobre ejecutar main.py en loop:
  - Carga el registro de voces UNA sola vez (no re-enrolla para cada lección).
  - Carga el caché de deduplicación UNA sola vez al inicio y lo mantiene en
    memoria durante toda la sesión. A medida que avanza, el caché crece y los
    textos repetidos se reusan sin llamar a Qwen TTS.
  - Muestra progreso global, ETA y resumen de ahorro al final.

Módulos disponibles:
  1 → adventure_1 (467 lecciones)
  2 → adventure_2 (410 lecciones)
  3 → adventure_3 (340 lecciones)
  4 → adventure_4 (340 lecciones)
```

### `backend/audio_factory/main.py` (Code)

```python
"""
main.py — Punto de entrada del audio_factory.

Uso:
  python main.py --lesson 1-1-0-1
  python main.py --lesson 1-1-0-1 --lang es
  python main.py --lesson 1-1-0-1 --lang en
  python main.py --lesson 1-1-0-1 --lang es,en      (ambos idiomas)
  python main.py --lesson 1-1-0-1 --reenroll         (re-enrolla las voces)
  python main.py --lesson 1-1-0-1 --dry-run          (solo muestra qué haría)

Proceso por ejercicio:
  1. Obtiene datos de la lección desde el backend REST API.
  2. Usa DeepSeek para extraer {target_field: texto} del exercise JSON.
  3. Genera audio MP3 con Qwen TTS + voice cloning (por personaje).
```

### `backend/audio_factory/migrate_to_r2.py` (Code)

```python
"""
migrate_to_r2.py — Migra audios de Supabase Storage → Cloudflare R2.

Proceso por cada registro en lesson_audio_segments con URL de Supabase:
  1. Descarga el MP3 desde la URL pública de Supabase.
  2. Extrae la clave R2 a partir del path del URL.
  3. Sube el MP3 a R2.
  4. Actualiza el audio_url en la DB con la nueva URL de R2.
  5. (Después de migrar todo) Elimina los archivos del bucket de Supabase.

Uso:
  python3 migrate_to_r2.py               # Migra y limpia
  python3 migrate_to_r2.py --dry-run     # Solo muestra qué haría
  python3 migrate_to_r2.py --skip-clean  # Migra pero no elimina de Supabase
"""
```

### `backend/audio_factory/storage_client.py` (Code)

```python
"""
storage_client.py — Sube archivos de audio al bucket de Cloudflare R2.

Ruta de destino en R2:
  {lesson_code}/{order_index}/{lang}/{target_field}.mp3

Devuelve la URL pública del archivo subido.

Notas:
  - R2 usa protocolo S3 compatible (boto3 con endpoint personalizado).
  - El bucket debe tener Public Access habilitado en Cloudflare Dashboard.
  - La URL pública base se configura en R2_PUBLIC_URL_BASE (ej: https://pub-XXX.r2.dev).
  - Si ya existe un archivo en la misma ruta, se sobreescribe (put_object es idempotente).
"""

```

### `backend/audio_factory/test_all_voices.py` (Code)

```python
"""
test_all_voices.py — Prueba de calidad para los 8 personajes × idioma.

Genera un audio de prueba por cada combinación (char, lang) y los guarda
en test_outputs/ para reproducirlos y evaluar la calidad.

Ejecutar:
    python3 test_all_voices.py
"""

import pathlib
import sys
import time

import tts_client
```

### `backend/audio_factory/test_voice.py` (Code)

```python
"""
test_voice.py — Prueba rápida de enrollment + TTS para un personaje.

Ejecutar:
    python3 test_voice.py

Qué hace:
  1. Enrolla liruf_es.mp3 en Qwen TTS
  2. Genera un audio de prueba con esa voz
  3. Guarda el resultado en test_output.mp3
  4. Muestra la duración detectada
"""

import pathlib
import sys
```

### `backend/audio_factory/tts_client.py` (Code)

```python
"""
tts_client.py — Genera audio MP3 usando Qwen TTS con voice cloning.

Estructura real de respuesta de DashScope (verificada):
  response.output.audio.url   → URL temporal para descargar el WAV generado
  response.output.audio.data  → siempre vacío (no se usa)
  response.output.choices     → null (no se usa)

Flujo:
  1. Llamada a dashscope.MultiModalConversation.call()
  2. Descarga del WAV desde la URL temporal
  3. Conversión WAV → MP3 via ffmpeg
  4. Cálculo de duración con mutagen
  5. Devuelve (bytes_mp3, duration_ms)
"""
```

### `backend/audio_factory/voice_registry.py` (Code)

```python
"""
voice_registry.py — Gestiona el enrollment de voces en Qwen TTS.

Cada personaje tiene DOS muestras de voz: una en español y otra en inglés,
porque las voces clonadas pueden diferir sutilmente entre idiomas.

Estructura de archivos esperada:
    voice_samples/liruf_es.mp3
    voice_samples/liruf_en.mp3
    voice_samples/dina_es.mp3
    voice_samples/dina_en.mp3
    voice_samples/dr_rho_es.mp3
    voice_samples/dr_rho_en.mp3
    voice_samples/zara_vex_es.mp3
    voice_samples/zara_vex_en.mp3
```

### `backend/auth/__init__.py` (Code)

```python

```

### `backend/auth/endpoints.py` (Code)

```python
from __future__ import annotations

from datetime import date, datetime, timedelta

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from auth.schemas import (
    GuestMergeRequest,
    SupabaseAuthRequest,
    UserResponse,
    UserUpdate,
```

### `backend/auth/permissions.py` (Code)

```python
"""
Helper functions for family-based access control
These functions ensure data integrity and prevent users from accessing
data from other families
"""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import User, UserType


def verify_family_access(
    db: Session,
```

### `backend/auth/schemas.py` (Code)

```python
from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_serializer, field_validator


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    birth_date: str | None = None
    gender: str | None = None
    avatar_config: dict | None = None
```

### `backend/auth/utils.py` (Code)

```python
from __future__ import annotations

from datetime import datetime, timedelta

from jose import JWTError, jwt

from config import settings


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
```

### `backend/config.py` (Code)

```python
from __future__ import annotations

import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # Don't fail if .env doesn't exist
        case_sensitive=False
    )
```

### `backend/dashboard/__init__.py` (Code)

```python

```

### `backend/dashboard/endpoints.py` (Code)

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth.endpoints import get_current_user_from_token
from auth.permissions import verify_family_access
from database import get_db
from models import User
from schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _resolve(db: Session, public_id: str) -> User:
    """Resolve a public UUID to a User object"""
    user = db.query(User).filter(User.public_id == public_id).first()
```

### `backend/database.py` (Code)

```python

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config import settings

# Create database URL
try:
    DATABASE_URL = f"postgresql://{settings.database_username}:{settings.database_password}@{settings.database_hostname}:{settings.database_port}/{settings.database_name}"

    # Create engine with connection pooling disabled for serverless
    # Vercel functions are stateless and short-lived
    engine = create_engine(
        DATABASE_URL,
```

### `backend/i18n/__init__.py` (Code)

```python
"""
i18n Module - Internationalization for LittleFounders Backend

This module provides a centralized system for handling translatable messages
in the backend. It supports multiple languages and provides a clean interface
for retrieving localized messages.

Usage:
    from i18n import get_message, MessageCode

    # Get a message in the default language (Spanish)
    msg = get_message(MessageCode.LOGIN_SUCCESS)

    # Get a message in a specific language
    msg = get_message(MessageCode.LOGIN_SUCCESS, "en")
```

### `backend/i18n/messages.py` (Code)

```python
"""
Centralized Message System for LittleFounders Backend

This module defines all translatable messages used in API responses,
error handling, and user-facing content. Messages are organized by
category and support multiple languages.

Supported Languages:
- es: Spanish (default)
- en: English

Adding a new message:
1. Add a new enum value to MessageCode
2. Add translations in both MESSAGES_ES and MESSAGES_EN dictionaries

```

### `backend/lesson_engine/__init__.py` (Code)

```python
# Lesson Engine Module
from .endpoints import router

__all__ = ['router']
```

### `backend/lesson_engine/endpoints.py` (Code)

```python
"""
Enduntos del Nuevo Motor de Lecciones (v2 - Flat i18n)
LittleFounders - 2026
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import HTTPException as _HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, defer

from database import get_db
from models import Character, CharacterGesture, Lesson, LessonAudioSegment, User, UserLessonProgress
```

### `backend/lesson_factory/curriculum/adventure_1.json` (Config)

```json
{
  "adventure": 1,
  "title_es": "El Archipiélago del Trueque",
  "title_en": "The Barter Archipelago",
  "age_range": "5-7",
  "total_lessons": 480,
  "primary_character": "liruf",
  "world_description_es": "Un archipiélago mágico donde cada isla enseña algo sobre el dinero. Liruf, el dinosaurio explorador, acompaña al niño en cada aventura.",
  "overarching_narrative_es": "Liruf encontró un mapa del tesoro. Cada isla del archipiélago guarda un secreto sobre el dinero. Para llegar al gran cofre del tesoro, hay que aprender todos los secretos.",

  "lessons_per_topic_default": 9,
  "topics_per_saga": "variable",

  "sagas": [
    {
```

### `backend/lesson_factory/curriculum/adventure_2.json` (Config)

```json
{
  "adventure": 2,
  "title_es": "El Bosque de la Abundancia",
  "title_en": "The Forest of Abundance",
  "age_range": "8-9",
  "total_lessons": 480,
  "primary_character": "dina",
  "world_description_es": "Un bosque mágico donde cada árbol tiene semillas de oro y cada río trae oportunidades. Dina, la exploradora, enseña a calcular, planear y comprar inteligentemente.",
  "overarching_narrative_es": "Dina descubrió que el Bosque de la Abundancia tiene secretos matemáticos. Solo los exploradores que saben sumar, planear y ahorrar pueden encontrar el Árbol de la Riqueza.",

  "sagas": [
    {
      "saga_number": 1,
      "title_es": "Los Números del Bosque",
      "title_en": "The Forest Numbers",
```

### `backend/lesson_factory/curriculum/adventure_3.json` (Config)

```json
{
  "adventure": 3,
  "title_es": "La Ciudad Digital",
  "title_en": "The Digital City",
  "age_range": "10-12",
  "total_lessons": 480,
  "primary_character": "dr_rho",
  "world_description_es": "Una metrópolis del futuro donde el dinero fluye por pantallas, los negocios nacen en apps, y la economía tiene reglas que hay que entender para prosperar.",
  "overarching_narrative_es": "Dr. Rho es el guía de una ciudad donde todo cambia rápido. Para sobrevivir y prosperar aquí, necesitas entender los sistemas: el banco, el mercado, la red, el negocio digital.",

  "sagas": [
    {
      "saga_number": 1,
      "title_es": "El Ciudadano Digital",
      "theme_es": "Sistema Bancario y Dinero Digital",
```

### `backend/lesson_factory/curriculum/adventure_4.json` (Config)

```json
{
  "adventure": 4,
  "title_es": "El Valle de los Inventores",
  "title_en": "The Valley of Inventors",
  "age_range": "13-14",
  "total_lessons": 480,
  "primary_character": "dr_rho",
  "world_description_es": "Un valle donde los mejores inventores, emprendedores y estrategas construyen sus imperios. Dr. Rho y Zara Vex guían a los estudiantes a través de conceptos financieros intermedios.",
  "overarching_narrative_es": "En El Valle, las ideas se convierten en negocios, los negocios en empresas, y las empresas en legados. Para triunfar aquí necesitas dominar las finanzas personales, el emprendimiento y los mercados.",

  "sagas": [
    {
      "saga_number": 1,
      "title_es": "El Arquitecto Financiero",
      "theme_es": "Finanzas Personales Intermedias",
```

### `backend/lesson_factory/curriculum/adventure_5.json` (Config)

```json
{
  "adventure": 5,
  "title_es": "El Reino de los Titanes",
  "title_en": "The Kingdom of Titans",
  "age_range": "15-17",
  "total_lessons": 576,
  "primary_character": "zara_vex",
  "world_description_es": "Un reino donde los jóvenes adultos enfrentan decisiones financieras reales: primer empleo, impuestos, crédito, inversiones serias. Zara Vex los guía hacia la independencia total.",
  "overarching_narrative_es": "En el Reino de los Titanes no hay simulaciones. Las decisiones tienen consecuencias reales. Zara Vex, que empezó desde cero y construyó su propio imperio, comparte los secretos que nadie te enseña en la escuela.",

  "sagas": [
    {
      "saga_number": 1,
      "title_es": "La Vida Adulta Financiera",
      "theme_es": "Primer Empleo, Nómina y Obligaciones",
```

### `backend/lesson_factory/curriculum/adventure_6.json` (Config)

```json
{
  "adventure": 6,
  "title_es": "Proyecto Omega",
  "title_en": "Project Omega",
  "age_range": "18+",
  "total_lessons": 576,
  "primary_character": "zara_vex",
  "world_description_es": "La aventura final. No hay guías ni tutoriales. Solo escenarios reales, decisiones complejas y casos de estudio de las mentes financieras más brillantes del mundo.",
  "overarching_narrative_es": "Proyecto Omega es la tesis del Fundador. Cada lección es un reto real que exige integrar todo lo aprendido. No hay respuestas fáciles. Solo el criterio construido a lo largo de 5 aventuras.",

  "sagas": [
    {
      "saga_number": 1,
      "title_es": "La Tesis del Fundador",
      "theme_es": "Síntesis Conceptual y Marcos Mentales",
```

### `backend/lesson_factory/generate.py` (Code)

```python
#!/usr/bin/env python3
"""
LittleFounders Lesson Factory - Generator
==========================================
Genera lecciones de alta calidad usando DeepSeek API.
Las lecciones siguen los blueprints de curriculum y las reglas pedagógicas.

Uso:
    python generate.py --adventure 1 --saga 1 --topic 2        # Un topic específico
    python generate.py --adventure 1 --saga 1                  # Toda una saga
    python generate.py --adventure 1                           # Toda una aventura
    python generate.py --adventure 1 --dry-run                 # Ver plan sin generar
    python generate.py --resume                                # Continuar desde donde quedó

Variables de entorno requeridas:
```

### `backend/lesson_factory/pedagogy_rules.json` (Config)

```json
{
  "version": "2.0",
  "description": "Reglas pedagógicas absolutas por aventura. Versión 2.0 integra el estándar RULES.md v1.2: estructura cognitiva de 5 fases por concepto (¿POR QUÉ IMPORTA? → ¿QUÉ ES? → ¿CÓMO SE USA? → ¿QUÉ ERROR EVITAR? → ¿CON QUÉ SE RELACIONA?), diversidad obligatoria de objetivos (Reconocer, Calcular, Comparar, Decidir, Aplicar), feedback instructivo que explica el 'por qué' del error, y lecciones estilo Duolingo con 8–15 ejercicios.",
  "rules_md_principles": {
    "non_negotiables": [
      "Enseñar mediante acción (decidir, calcular, analizar), no solo lectura pasiva",
      "Limitarse a 5-7 conceptos nuevos máximo por lección",
      "Anclar cada concepto a una situación real comprensible para la edad objetivo",
      "El feedback de error DEBE explicar el 'por qué' del error, no solo marcarlo",
      "La lección debe requerir ≥80% de precisión conceptual para considerarse válida"
    ],
    "forbidden": [
      "Usar jerga sin definición contextual inmediata",
      "Presentar fórmulas sin unidades, rango típico o propósito claro",
      "Asumir conocimientos previos no declarados como prerrequisito",
```

### `backend/lesson_factory/validate.py` (Code)

```python
#!/usr/bin/env python3
"""
LittleFounders Lesson Factory - Validator
==========================================
Valida la calidad pedagógica y estructura técnica de las lecciones generadas.

Uso:
    python validate.py --lesson adventure_1/saga_1/topic_2/lesson_1.json
    python validate.py --adventure 1                    # Toda la aventura
    python validate.py --adventure 1 --saga 1           # Una saga
    python validate.py --all                            # Todo
    python validate.py --adventure 1 --fix              # Intentar corregir automáticamente
    python validate.py --stats                          # Solo estadísticas
"""
from __future__ import annotations
```

### `backend/main.py` (Code)

```python
import asyncio
import os
import sys
import time as _time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from utils.limiter import limiter

# ── ANSI colors (solo en TTY) ──────────────────────────────────────
```

### `backend/models.py` (Code)

```python
from __future__ import annotations

import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
```

### `backend/nixpacks.toml` (Config)

```toml
# Pin Python 3.11 para Railway (Nixpacks). El proyecto requiere >=3.11.
[phases.setup]
nixPkgs = ["python311", "gcc"]

[phases.install]
cmds = ["python -m venv /opt/venv && . /opt/venv/bin/activate && pip install -r requirements.txt"]

[start]
cmd = "uvicorn main:app --host 0.0.0.0 --port $PORT"
```

### `backend/notifications/__init__.py` (Code)

```python

```

### `backend/notifications/endpoints.py` (Code)

```python
"""
Notification endpoints:
  /notifications/*        — user-facing (get, read, dismiss)
  /admin/notifications/*  — admin management (CRUD)
"""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from admin.permissions import require_admin
from auth.endpoints import get_current_user_from_token
```

### `backend/notifications/helpers.py` (Code)

```python
"""
Helper functions to create automatic notifications (follow, streak, achievements, etc.)
Import and call these from other modules (social, lesson_engine, etc.)
"""
from sqlalchemy.orm import Session

from models import (
    Notification,
    NotificationPriority,
    NotificationStatus,
    NotificationTargetType,
    NotificationType,
    User,
    UserNotification,
)
```

### `backend/notifications/schemas.py` (Code)

```python
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# ── User-facing schemas ──

class NotificationOut(BaseModel):
    public_id: str
    type: str
    priority: str
    title: str  # resolved by user's language
    body: str | None = None
    media_url: str | None = None
```

### `backend/pyproject.toml` (Config)

```toml
[project]
name = "littlefounders-api"
version = "1.0.0"
description = "LittleFounders AI - Plataforma educativa de alfabetización financiera"
requires-python = ">=3.11"

# ── Ruff (Linter) ───────────────────────────────────────────────────
[tool.ruff]
target-version = "py311"
line-length = 100
exclude = [".venv", ".git", "__pycache__"]

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
ignore = ["E402", "E501", "E701", "E722", "E741", "F402", "N806", "N811", "UP007"]
```

### `backend/railway.json` (Config)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### `backend/reports/__init__.py` (Code)

```python

```

### `backend/reports/endpoints.py` (Code)

```python
from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth.endpoints import get_current_user_from_token
from database import get_db
from models import PlatformReport, User
from reports.schemas import ReportAdminResponse, ReportCreate, ReportResponse, ReportStatusUpdate

```

### `backend/reports/schemas.py` (Code)

```python
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, field_validator

# ── Request Schemas ────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    """Schema para crear un nuevo reporte desde el formulario."""
    reporter_email: EmailStr
    report_type: str = "other"  # bug | abuse | suggestion | content | other
    subject: str
    reported_url: str | None = None
```

### `backend/schemas.py` (Code)

```python
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, model_validator


# Dashboard Schemas
class DashboardStats(BaseModel):
    lessons_completed: int
    minutes_studied: int
    points_earned: int
    current_streak: int
    balance: float

```

### `backend/scripts/__init__.py` (Code)

```python
# Scripts de pipeline para lecciones
```

### `backend/scripts/clear_all_lessons.py` (Code)

```python
"""
Script to DELETE ALL LESSONS from the database.
CRITICAL: This deletes all lessons, exercises, audio references, and USER PROGRESS.
Use with caution.

Usage: python scripts/clear_all_lessons.py
"""

import os
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

```

### `backend/scripts/create_verification_lessons.py` (Code)

```python
import logging
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from models import Lesson

# Configure logging
logging.basicConfig(level=logging.INFO)
```

### `backend/scripts/generate_audio.py` (Code)

```python
"""
Pipeline de Generación de Audio para Lecciones - LittleFounders
================================================================

Este script genera audios para las lecciones usando LF Audio Engine,
los sube a Supabase Storage, y actualiza la base de datos.

IMPORTANTE: Los audios se generan UNA VEZ y se almacenan para
optimizar el rendimiento.

Uso:
    python generate_audio.py --lesson-code 1-1-1
    python generate_audio.py --lesson-code 1-1-1 --dry-run
"""
from __future__ import annotations
```

### `backend/scripts/image_generator.py` (Code)

```python
import io
import os
from pathlib import Path

from dotenv import load_dotenv

# Load env from parent directory
load_dotenv(Path(__file__).parent.parent / ".env")

try:
    from google import genai
    from google.genai import types
    from PIL import Image
    from supabase import Client, create_client
except ImportError as e:
```

### `backend/scripts/import_lessons.py` (Code)

```python
#!/usr/bin/env python3
"""
LittleFounders Lesson Import Script
Imports 3,072 lessons from JSON files to PostgreSQL database.

Usage:
    python scripts/import_lessons.py              # Full import
    python scripts/import_lessons.py --verify     # Verify after import
    python scripts/import_lessons.py --count      # Just count existing lessons
"""

import json
import sys
from datetime import datetime
from pathlib import Path
```

### `backend/scripts/lf_audio_client.py` (Code)

```python
"""
LittleFounders Audio Engine - Python SDK Client
Conecta al microservicio de generación de audio LF Audio Engine.
"""
from __future__ import annotations

import os
from pathlib import Path

import requests

# Load .env from backend directory
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
```

### `backend/scripts/list_models.py` (Code)

```python
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai

load_dotenv(Path(__file__).parent.parent / ".env")
api_key = os.environ.get("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)
try:
    models = client.models.list()
    print("Available Models:")
    for m in models:
        print(f"- {m.name} ({m.display_name})")
```

### `backend/scripts/restructure_db.py` (Code)

```python
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load Env
load_dotenv(Path(__file__).parent.parent / ".env")

DATABASE_URL = f"postgresql://{os.environ.get('DATABASE_USERNAME')}:{os.environ.get('DATABASE_PASSWORD')}@{os.environ.get('DATABASE_HOSTNAME')}:{os.environ.get('DATABASE_PORT')}/{os.environ.get('DATABASE_NAME')}"

```

### `backend/scripts/test_schema_serialization.py` (Code)

```python
"""
test_schema_serialization.py
────────────────────────────
Guard script to catch Pydantic v2 type mismatch issues BEFORE they hit production.

Run with:  python3 backend/scripts/test_schema_serialization.py

What it tests:
  - Every Pydantic response schema that uses `from_attributes = True`
  - Both direct instantiation AND ORM-mode validation (model_validate)
  - Realistic mock objects that mirror what SQLAlchemy actually returns
    (uuid.UUID objects, datetime objects, list/dict from JSON columns, etc.)

Context: Pydantic v2 is strict — it will NOT coerce uuid.UUID → str, or
Python enum objects → str automatically. Mismatches cause 500 errors at
```

### `backend/scripts/verify_all_lessons.py` (Code)

```python
import sys

import requests

BASE_URL = "http://localhost:8000/lesson-engine/lessons"

def check_lesson(index):
    code = f"0-0-0-{index}"
    url = f"{BASE_URL}/{code}/play"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            print(f"FAIL {code}: Status {response.status_code}")
            return False

```

### `backend/scripts/verify_api_data.py` (Code)

```python
import json
import sys

import requests

BASE_URL = "http://localhost:8000/lesson-engine/lessons"

def check_lesson(code, check_fn):
    url = f"{BASE_URL}/{code}/play"
    try:
        response = requests.get(url)
        if response.status_code != 200:
            print(f"FAIL {code}: Status {response.status_code}")
            return False

```

### `backend/social/__init__.py` (Code)

```python
# Default init
```

### `backend/social/endpoints.py` (Code)

```python

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth.endpoints import get_current_user_from_token, get_current_user_optional
from database import get_db
from models import Follow, FollowStatus, User, UserType
from notifications.helpers import notify_follow_accepted, notify_follow_request, notify_new_follower

from .schemas import FollowActionResponse, FollowRequestResponse, UserPublicProfile

router = APIRouter(prefix="/social", tags=["Social"])
```

### `backend/social/schemas.py` (Code)

```python
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class UserPublicProfile(BaseModel):
    public_id: str
    username: str
    name: str | None = None
    avatar_config: dict | None = None
    lessons_completed: int = 0
    points_earned: int = 0
    current_streak: int = 0
```

### `backend/tests/__init__.py` (Code)

```python

```

### `backend/tests/conftest.py` (Code)

```python
import os

import pytest
from dotenv import load_dotenv

load_dotenv(".env.test")


@pytest.fixture(scope="session")
def test_db_url() -> str:
    return (
        f"postgresql://{os.getenv('DATABASE_USERNAME', 'postgres')}"
        f":{os.getenv('DATABASE_PASSWORD', 'postgres')}"
        f"@{os.getenv('DATABASE_HOSTNAME', 'localhost')}"
        f":{os.getenv('DATABASE_PORT', '5432')}"
```

### `backend/tests/test_health.py` (Code)

```python
import pytest


@pytest.mark.asyncio
async def test_health_endpoint(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
```

### `backend/utils/gesture_mapper.py` (Code)

```python
"""
Gesture Mapper Utility

Provides gesture equivalence mappings and default fallbacks for character gestures.
This ensures backward compatibility when lesson data uses old/different gesture codes.
"""
from __future__ import annotations

# Gesture equivalence mappings per character
# Maps old/alternative gesture names to actual component prop values
GESTURE_EQUIVALENCES: dict[str, dict[str, any]] = {
    'liruf': {
        'default': 'happy',
        'mappings': {
            # Actual gestures (DinoCharacter moods)
```

### `backend/utils/limiter.py` (Code)

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
```

### `frontend/components.json` (Config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
```

### `frontend/eslint.config.js` (Code)

```javascript
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
```

### `frontend/index-en.html` (Code)

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Little Founders - Financial Education for Kids</title>
  <meta name="description"
    content="Financial education platform for kids with interactive games and economy lessons" />
  <meta name="author" content="Little Founders" />

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
```

### `frontend/index.html` (Code)

```html
<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Little Founders - Educación Financiera para Niños</title>
  <meta name="description"
    content="Plataforma educativa de finanzas para niños con juegos interactivos y lecciones de economía" />
  <meta name="author" content="Little Founders" />

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
```

### `frontend/package.json` (Config)

```json
{
  "name": "vite_react_shadcn_ts",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint src/ --report-unused-disable-directives",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview",
    "backend": "cd backend && python3 main.py",
```

### `frontend/postcss.config.js` (Code)

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### `frontend/src/App.css` (Code)

```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
```

### `frontend/src/App.tsx` (Code)

```typescript
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AnimatedRoutes } from "@/components/transitions/AnimatedRoutes";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ParentProtectedRoute } from "@/components/auth/ParentProtectedRoute";
import { ChildProtectedRoute } from "@/components/auth/ChildProtectedRoute";
import { Analytics } from '@vercel/analytics/react';

// Pages
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
```

### `frontend/src/__tests__/lessonEngine.test.ts` (Code)

```typescript
import { describe, it, expect } from 'vitest';
import { extractCorrectId } from '@/components/lessons/engine/hooks/useLessonState';

describe('extractCorrectId', () => {
    it('returns undefined for null/non-object inputs', () => {
        expect(extractCorrectId(null)).toBeUndefined();
        expect(extractCorrectId(undefined)).toBeUndefined();
        expect(extractCorrectId('a')).toBeUndefined();
        expect(extractCorrectId(42)).toBeUndefined();
    });

    it('extracts the canonical correctOptionId', () => {
        expect(extractCorrectId({ correctOptionId: 'opt1' })).toBe('opt1');
    });

```

### `frontend/src/__tests__/optionSource.test.ts` (Code)

```typescript
import { describe, it, expect } from 'vitest';
import { resolveOptions } from '@/components/lessons/engine/activities/optionSource';

describe('resolveOptions', () => {
    it('returns [] for empty/invalid content', () => {
        expect(resolveOptions(null)).toEqual([]);
        expect(resolveOptions({})).toEqual([]);
    });

    it('reads an array under content.options preserving ids', () => {
        const r = resolveOptions({ options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] });
        expect(r.map(o => o.id)).toEqual(['a', 'b']);
        expect(r[0].text).toBe('A');
    });

```

### `frontend/src/__tests__/placeholder.test.ts` (Code)

```typescript
import { describe, it, expect } from "vitest";

describe("placeholder", () => {
  it("should pass", () => {
    expect(1 + 1).toBe(2);
  });
});
```

### `frontend/src/__tests__/setup.ts` (Code)

```typescript
import "@testing-library/jest-dom/vitest";
```

### `frontend/src/__tests__/useAdminAlerts.test.tsx` (Code)

```typescript
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks (hoisted so they're available inside vi.mock factories) ──
const { mockStats, mockList } = vi.hoisted(() => ({
  mockStats: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}));

```

### `frontend/src/__tests__/useAdminSettings.test.ts` (Code)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminSettings, ADMIN_SETTINGS_KEY } from '@/hooks/useAdminSettings';

describe('useAdminSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.reduceMotion;
  });

  it('returns defaults when nothing is stored', () => {
    const { result } = renderHook(() => useAdminSettings());
    expect(result.current.settings).toEqual({
      reduceMotion: false,
      showNotifBadge: true,
```

### `frontend/src/__tests__/validateAnswer.corpus.test.ts` (Code)

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateAnswer, extractCorrectId } from '@/components/lessons/engine/hooks/useLessonState';

/**
 * Corpus-driven regression guard.
 *
 * For the exercise types whose CORRECT answer can be synthesized deterministically
 * from the real lesson JSON, we feed that synthesized correct answer to validateAnswer
 * and assert it is accepted. This catches any regression that would turn a genuinely
 * correct answer into a false negative (the bug class this work fixes) across the
 * entire production corpus — not just hand-picked samples.
 *
 * If the corpus is not present (e.g. CI without the backend checked out), the suite
```

### `frontend/src/__tests__/validateAnswer.test.ts` (Code)

```typescript
import { describe, it, expect } from 'vitest';
import { validateAnswer } from '@/components/lessons/engine/hooks/useLessonState';

// Helper: build a minimal exercise object accepted by validateAnswer.
const ex = (type: string, content: any, correct_answer: any) =>
    ({ id: 1, type, content, correct_answer } as any);

// Each case mirrors a REAL correct_answer shape from the lesson corpus
// (backend/lesson_engine/littlefounders_lessons) confirmed by the 2026-06-16 audit.

describe('validateAnswer — option-based (regression)', () => {
    it('multiple_choice {correctOptionId}', () => {
        const e = ex('multiple_choice', { options: [{ id: 'a' }, { id: 'b' }] }, { correctOptionId: 'a' });
        expect(validateAnswer(e, 'a')).toBe(true);
        expect(validateAnswer(e, 'b')).toBe(false);
```

### `frontend/src/components/admin/AdminActivityChart.tsx` (Code)

```typescript
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { subDays, format, parseISO, eachDayOfInterval, eachMonthOfInterval, endOfMonth, isSameMonth } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

interface AdminActivityChartProps {
    data: Array<{
        date: string;
        [key: string]: string | number;
    }>;
}
```

### `frontend/src/components/admin/AdminContributionGraph.tsx` (Code)

```typescript
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { subDays, eachDayOfInterval, format, getDay } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

interface AdminContributionGraphProps {
    data: Array<{
        date: string;
        [key: string]: string | number;
    }>;
}
```

### `frontend/src/components/admin/AdminLayout.tsx` (Code)

```typescript
import { useState, ReactNode } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminNotificationBell } from "./AdminNotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation('admin');
```

### `frontend/src/components/admin/AdminNotificationBell.tsx` (Code)

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Flag, PencilLine, Megaphone, CheckCheck, Inbox, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAdminAlerts, type AdminAlertKind } from '@/hooks/useAdminAlerts';
import { useAdminSettings } from '@/hooks/useAdminSettings';

const KIND_ICON: Record<AdminAlertKind, React.ElementType> = {
  report: Flag,
  edit: PencilLine,
```

### `frontend/src/components/admin/AdminProtectedRoute.tsx` (Code)

```typescript
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const userStr = localStorage.getItem('user');

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

```

### `frontend/src/components/admin/AdminSidebar.tsx` (Code)

```typescript
import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  Users,
  UserCog,
  Headphones,
  History,
  HelpCircle,
  Menu,
  X,
  LogOut,
```

### `frontend/src/components/admin/ExerciseEditorForms.tsx` (Code)

```typescript
/**
 * ExerciseEditorForms.tsx
 * Visual form editors for each exercise type, replacing raw JSON editing.
 * Renders appropriate form fields based on exercise type.
 */
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGestureLabels } from '@/utils/gestureMapper';
```

### `frontend/src/components/admin/ExerciseEditorModal.tsx` (Code)

```typescript
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
```

### `frontend/src/components/admin/ExercisePreview.tsx` (Code)

```typescript
/**
 * ExercisePreview — Lightweight visual preview of an exercise as students would see it.
 * No API calls, no audio, no confetti — just a visual simulation.
 */
import React from 'react';
import { EXERCISE_TYPE_ICONS } from './ExerciseEditorForms';

interface ExercisePreviewProps {
    exercise: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}

/** Simulated phone-like container */
const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
```

### `frontend/src/components/admin/utils/transformToTimeline.ts` (Code)

```typescript
/**
 * Transforma el JSON editado al formato que espera el LessonRunner.
 * El LessonRunner NO consume directamente content_es/content_en.
 * Espera una estructura LessonData con timeline transformado.
 */

export interface RawExercise {
  type: string;
  character_code?: string;
  content: Record<string, any>;
  correct_answer?: Record<string, any>;
  feedback?: { success: string; error: string };
}

export interface LessonJSON {
```

### `frontend/src/components/analytics/GoogleAnalytics.tsx` (Code)

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_TRACKING_ID = 'G-0XH7S80QG2';

export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Only track in production (not on localhost)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return;
    }

    // Send page view event
```

### `frontend/src/components/auth/AuthLayout.tsx` (Code)

```typescript
import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  showBackToWelcome?: boolean;
}

export function AuthLayout({ children, title, description, showBackToWelcome = true }: AuthLayoutProps) {
  return (
```

### `frontend/src/components/auth/ChildProtectedRoute.tsx` (Code)

```typescript
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ChildProtectedRouteProps {
  children: ReactNode;
}

export function ChildProtectedRoute({ children }: ChildProtectedRouteProps) {
  // Obtener información del usuario desde localStorage
  const userStr = localStorage.getItem('user');

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

```

### `frontend/src/components/auth/GuestBanner.tsx` (Code)

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { X, UserPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGuestProfile } from "@/lib/guestProfile";

export function GuestBanner() {
    const { t } = useTranslation('dashboard');
    const [dismissed, setDismissed] = useState(false);
    const guest = getGuestProfile();

    if (dismissed || !guest) return null;

    return (
```

### `frontend/src/components/auth/GuestNudgeModal.tsx` (Code)

```typescript
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Sparkles, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getGuestProfile, isGuest } from "@/lib/guestProfile";

/**
 * GuestNudgeModal — gentle, Duolingo-style reminder for guests to create an
 * account so their progress becomes permanent. Low-friction by design:
 *  - Only for guests with no real account (stops automatically once registered).
 *  - At most once per browser session, and never more often than every 4 hours.
 *  - Appears a few seconds AFTER entering the app (never blocks the first paint).
 * The always-visible amber GuestBanner is the persistent reminder; this is the
 * occasional one.
```

### `frontend/src/components/auth/LanguageSyncWrapper.tsx` (Code)

```typescript
import { useUserLanguage } from "@/hooks/useUserLanguage";
import { ReactNode, useEffect } from "react";

// Este componente no renderiza nada visualmente, solo ejecuta el hook de sincronización
export const LanguageSyncWrapper = ({ children }: { children: ReactNode }) => {
    const { syncLanguagePreference, isAuthenticated } = useUserLanguage();

    useEffect(() => {
        if (isAuthenticated()) {
            syncLanguagePreference();
        }
    }, [syncLanguagePreference, isAuthenticated]);

    return <>{children}</>;
};
```

### `frontend/src/components/auth/ParentProtectedRoute.tsx` (Code)

```typescript
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ParentProtectedRouteProps {
  children: ReactNode;
}

export function ParentProtectedRoute({ children }: ParentProtectedRouteProps) {
  // Obtener información del usuario desde localStorage
  const userStr = localStorage.getItem('user');

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

```

### `frontend/src/components/auth/PasswordStrength.tsx` (Code)

```typescript
import React from 'react';

interface PasswordStrengthProps {
  password?: string;
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password = '' }) => {
  const getStrength = (password: string) => {
    let score = 0;
    if (!password) return score;

    // Award points for different criteria
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
```

### `frontend/src/components/auth/ProtectedRoute.tsx` (Code)

```typescript
import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isGuest } from "@/lib/guestProfile";

interface ProtectedRouteProps {
  children: ReactNode;
  /** When true, only authenticated users are allowed (guests are redirected to /login).
   *  When false (default), authenticated users AND guests with completed onboarding are allowed.
   *  Anonymous users (no auth, no guest profile) are always redirected to /onboarding. */
  requireAuth?: boolean;
}

export function ProtectedRoute({ children, requireAuth = false }: ProtectedRouteProps) {
```

### `frontend/src/components/avatar/AvatarDisplay.tsx` (Code)

```typescript
import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export interface AvatarConfig {
    accessories?: string[];
    accessoriesColor?: string[];
    clothing?: string[];
    clothesColor?: string[];
    eyebrows?: string[];
    eyes?: string[];
    facialHair?: string[];
```

### `frontend/src/components/characters/DinaCharacter.tsx` (Code)

```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DinaCharacterProps {
    expression?: 'neutral' | 'happy' | 'surprised' | 'wink';
    className?: string;
    enableMouseTracking?: boolean;
    showBubble?: boolean;
    currentText?: string;
    bubblePosition?: 'top' | 'standard';
    isTalking?: boolean;
}

/**
 * Dina — The friendly orange stegosaurus.
```

### `frontend/src/components/characters/DinoCharacter.tsx` (Code)

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next';

export type DinoMood = 'happy' | 'sad' | 'excited' | 'thinking' | 'shocked';

interface DinoCharacterProps {
    currentText?: string;
    showBubble?: boolean;
    className?: string;
    mood?: DinoMood;
    bubblePosition?: 'demo' | 'tutorial' | 'standard' | 'hero';
    isTalking?: boolean;
}

```

### `frontend/src/components/characters/DrRhoCharacter.tsx` (Code)

```typescript
import React, { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export type RhoMood = 'neutral' | 'wise' | 'mysterious' | 'explaining' | 'surprised';

interface DrRhoCharacterProps {
    className?: string;
    mood?: RhoMood;
    showBubble?: boolean;
    currentText?: string;
    bubblePosition?: 'top' | 'right';
    isTalking?: boolean;
}

const COLORS = {
```

### `frontend/src/components/characters/ZaraVexCharacter.tsx` (Code)

```typescript
import React, { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export type ZaraMood = 'neutral' | 'happy' | 'flirty' | 'curious' | 'excited';

interface ZaraVexCharacterProps {
    className?: string;
    mood?: ZaraMood;
    showBubble?: boolean;
    currentText?: string;
    bubblePosition?: 'top' | 'right';
    isTalking?: boolean;
}

const COLORS = {
```

### `frontend/src/components/common/ReportFAB.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Flag } from "lucide-react";
import { ReportModal } from "./ReportModal";

/**
 * ReportFAB — Floating Action Button para levantar un reporte desde cualquier página.
 *
 * Características:
 * - Diseño "Glassmorphism" sutil y no intrusivo.
 * - Soporte para arrastrar y soltar (Drag & Drop) con auto-acoplamiento a los bordes.
 * - Persistencia de posición mediante localStorage.
 * - Tamaño reducido para no obstruir la navegación.
 */
interface ReportFABProps {
```

### `frontend/src/components/common/ReportModal.tsx` (Code)

```typescript
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Flag, Upload, CheckCircle2, Loader2, ExternalLink, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReportType = "bug" | "abuse" | "suggestion" | "content" | "other";

interface ReportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called to close the modal */
```

### `frontend/src/components/dashboard/CustomerAnalytics.tsx` (Code)

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, UserMinus, Filter } from "lucide-react";

// Datos de adquisición de nuevos usuarios (¡cómo llegan tus nuevos amigos a la plataforma!)
const acquisitionData = [
  { month: "Ene", organic: 45, paid: 32, referral: 18, direct: 25 },
  { month: "Feb", organic: 52, paid: 38, referral: 22, direct: 28 },
  { month: "Mar", organic: 48, paid: 45, referral: 25, direct: 32 },
  { month: "Abr", organic: 61, paid: 42, referral: 28, direct: 35 },
  { month: "May", organic: 58, paid: 48, referral: 32, direct: 38 },
  { month: "Jun", organic: 65, paid: 55, referral: 35, direct: 42 },
];

```

### `frontend/src/components/dashboard/DashboardLayout.tsx` (Code)

```typescript
import { useState, ReactNode, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { UserTour } from "./UserTour";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { GuestBanner } from "@/components/auth/GuestBanner";
import { GuestNudgeModal } from "@/components/auth/GuestNudgeModal";
import { isGuest } from "@/lib/guestProfile";

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

interface DashboardLayoutProps {
  children?: ReactNode;
```

### `frontend/src/components/dashboard/KPICard.tsx` (Code)

```typescript
import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  target?: string;
  targetProgress?: number;
  variant: "revenue" | "customers" | "product" | "team";
  icon: React.ComponentType<{ className?: string }>;
}
```

### `frontend/src/components/dashboard/ParentDashboard.tsx` (Code)

```typescript
import React from "react";
import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";

interface ParentDashboardProps {
  user: any;
}

export function ParentDashboard({ user }: ParentDashboardProps) {
  const { t } = useTranslation('common');

  return (
    <div className="corp flex flex-col items-center justify-center min-h-[80vh] text-center p-4 animate-in fade-in duration-500">
      <div className="corp-icon-chip w-24 h-24 mb-6">
        <Construction className="w-12 h-12" />
```

### `frontend/src/components/dashboard/RevenueChart.tsx` (Code)

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp } from "lucide-react";

const revenueData = [
  { month: "Ene", mrr: 8500, arr: 102000, previous: 7800 },
  { month: "Feb", mrr: 9200, arr: 110400, previous: 8100 },
  { month: "Mar", mrr: 9800, arr: 117600, previous: 8500 },
  { month: "Abr", mrr: 10500, arr: 126000, previous: 9200 },
  { month: "May", mrr: 11200, arr: 134400, previous: 9800 },
  { month: "Jun", mrr: 12000, arr: 144000, previous: 10500 },
  { month: "Jul", mrr: 13500, arr: 162000, previous: 11200 },
  { month: "Ago", mrr: 14200, arr: 170400, previous: 12000 },
  { month: "Sep", mrr: 15800, arr: 189600, previous: 13500 },
```

### `frontend/src/components/dashboard/Sidebar.tsx` (Code)

```typescript
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import {
  Settings,
  HelpCircle,
  Home,
  BookOpen,
  Trophy,
  ClipboardList,
  PiggyBank,
  Store,
  TrendingUp,
  ChevronsLeftRight,
  Lock,
```

### `frontend/src/components/dashboard/TopNav.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import {
  Bell, User, Settings, LogOut, HelpCircle,
  UserPlus, UserCheck, Flame, Trophy, BookOpen, Megaphone, Clock, Sparkles,
  Check, CheckCheck, X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
```

### `frontend/src/components/dashboard/UserTour.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
    targetId?: string;
    title: string;
    description: string;
    position?: "right" | "bottom" | "center";
    mood?: any; // To hold ZaraMood or RhoMood
}

```

### `frontend/src/components/families/BenefitGrid.tsx` (Code)

```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface BenefitItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface BenefitGridProps {
  items: BenefitItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

```

### `frontend/src/components/families/CharacterSection.tsx` (Code)

```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface CharacterSectionProps {
  character: React.ReactNode;
  title: string;
  subtitle?: string;
  description: string;
  features?: string[];
  characterPosition?: 'left' | 'right';
  className?: string;
}

export const CharacterSection: React.FC<CharacterSectionProps> = ({
  character,
```

### `frontend/src/components/families/FeatureCard.tsx` (Code)

```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
```

### `frontend/src/components/landing/CompoundInterestRunner.tsx` (Code)

```typescript
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, AlertCircle, Coins, ShieldAlert, Award, Star, PiggyBank, Target, Zap, CreditCard, Flame, XCircle } from 'lucide-react';

interface GameObject {
    id: number;
    x: number;
    y: number;
    speed: number;
    type: 'obstacle' | 'powerup';
    subtype: number; // to select between different labels
}

export function CompoundInterestRunner() {
    const { t } = useTranslation('landing');
```

### `frontend/src/components/landing/EmailWaitlistForm.tsx` (Code)

```typescript
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Mail, Send } from 'lucide-react';

interface EmailWaitlistFormProps {
  ctaLabel: string;
  placeholder: string;
  successMsg: string;
  language: string;
  source?: string;
}

export function EmailWaitlistForm({
  ctaLabel,
```

### `frontend/src/components/landing/GamifiedLearningSection.tsx` (Code)

```typescript
import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";

export function GamifiedLearningSection() {
  const { t } = useTranslation("landing");

  const benefits = [
    t("solution.benefit1"),
    t("solution.benefit2"),
    t("solution.benefit3"),
  ];
  return (
    <section className="relative py-20 md:py-28 overflow-hidden transition-colors duration-500 text-amber-950 dark:text-white bg-amber-50/50 dark:bg-[#0d0a0a] dark:via-[#0d0905] dark:to-[#0a0e0a]">

```

### `frontend/src/components/landing/LandingFooter.tsx` (Code)

```typescript
import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Mail, ShieldCheck, Globe, Sparkles } from "lucide-react";
import { EmailWaitlistForm } from "@/components/landing/EmailWaitlistForm";

interface LandingFooterProps {
  hideCTA?: boolean;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ hideCTA = false }) => {
  const { t, i18n } = useTranslation("landing");
  const lang = i18n.language;

  const productLinks = [
```

### `frontend/src/components/landing/LandingLayout.tsx` (Code)

```typescript
import React from "react";
import { LandingNavbar } from "./LandingNavbar";
import { LandingFooter } from "./LandingFooter";

interface LandingLayoutProps {
    children: React.ReactNode;
    hideCTA?: boolean;
}

export const LandingLayout: React.FC<LandingLayoutProps> = ({ children, hideCTA = false }) => {
    return (
        <div className="corp min-h-screen bg-white dark:bg-[#070b14] landing-page-root selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-500/40 dark:selection:text-white transition-colors duration-300">
            <LandingNavbar />
            
            <main className="view-transition-content">
```

### `frontend/src/components/landing/LandingNavbar.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, X, ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { hasSession } from "@/lib/guestProfile";

export const LandingNavbar = () => {
    const { t } = useTranslation('landing');
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    // Returning users get a "Continue" CTA back into the app; new users register.
    const session = hasSession();
```

### `frontend/src/components/landing/LandingParentCTA.tsx` (Code)

```typescript
import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, Users, Gamepad2, Trophy } from "lucide-react";

/* ── Stat chip ─────────────────────────────────────────────────────────────── */
function StatChip({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-5 py-3 rounded-2xl glass-chip">
      <span className="text-xl">{emoji}</span>
      <span className="text-gray-900 dark:text-white font-black text-lg leading-none">{value}</span>
      <span className="text-gray-500 dark:text-white/50 text-[11px] font-medium">{label}</span>
    </div>
  );
```

### `frontend/src/components/landing/LiquidGlassMedia.tsx` (Code)

```typescript
import React from 'react';
import { StockImage } from './StockImage';

interface LiquidGlassMediaProps {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  fallbackClassName?: string;
  delay?: string;
  badges?: React.ReactNode;
}

export const LiquidGlassMedia: React.FC<LiquidGlassMediaProps> = ({
  type,
  src,
```

### `frontend/src/components/landing/Reveal.tsx` (Code)

```typescript
import React from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

type RevealVariant = "up" | "left" | "right" | "scale";

interface RevealProps {
  children: React.ReactNode;
  /** Direction the element animates in from. Default: "up". */
  variant?: RevealVariant;
  /** Stagger delay in ms. */
  delay?: number;
  className?: string;
  /** Render as a different element (e.g. "li", "section"). Default: "div". */
  as?: keyof JSX.IntrinsicElements;
  once?: boolean;
```

### `frontend/src/components/landing/StockImage.tsx` (Code)

```typescript
import React, { useState } from "react";

interface StockImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Gradient shown while loading or if the image fails (keeps layout intact). */
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
}

/**
 * StockImage — renders a free-license (Unsplash) photo with a graceful
 * gradient fallback so the corporate layout never breaks on a dead link
 * or slow network. The gradient stays visible behind the image and is
```

### `frontend/src/components/lessons/AdventureCard.tsx` (Code)

```typescript
import React from 'react';

interface AdventureCardProps {
    title: string;
    theme: 'archipelago' | 'forest' | 'city' | 'valley' | 'kingdom' | 'cosmos';
    status: 'available' | 'locked' | 'completed';
    progress?: number;
    ageRange?: string;
    hideTitle?: boolean;
}

export const AdventureCard: React.FC<AdventureCardProps> = ({
    title,
    theme,
    status,
```

### `frontend/src/components/lessons/Adventures.tsx` (Code)

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ChevronRight, BookOpen } from 'lucide-react';
import { AdventureCard } from './AdventureCard';
import { useAdventuresAPI, Adventure } from './hooks/useAdventures';
import { useResumeLesson } from './hooks/useResumeLesson';
import { useSagaData } from './hooks/useSagaData';
import { useTranslation } from 'react-i18next';
import { LessonsLoadingScreen } from '../ui/LoadingScreen';

interface AdventuresProps {
    onSelectAdventure?: (adventureId: number) => void;
    onResumeMap?: (adventureId: number, sagaId: number, sagaTitle: string) => void;
    userId?: string;
}
```

### `frontend/src/components/lessons/LessonPath.tsx` (Code)

```typescript
/**
 * LessonPath - Ruta gamificada por Temas (Units) estilo Duolingo
 * Mobile-first, dark mode compatible, grouped by Topic
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, Star, Play, BookOpen, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { LessonItem } from './hooks/useLessonsList';

interface LessonPathProps {
    lessons: LessonItem[];
```

### `frontend/src/components/lessons/SagaView.tsx` (Code)

```typescript
import React from 'react';
import { ArrowLeft, BookOpen, Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { TopicNode } from './TopicNode';
import { AdventureCard } from './AdventureCard';
import { useTranslation } from 'react-i18next';
import { useSagaData, SagaData } from './hooks/useSagaData';

// ============== COMPONENTS ==============

const SagaHeader: React.FC<{ saga: SagaData }> = ({ saga }) => {
    return (
        <div className="corp-panel p-6 mb-8 rounded-3xl flex items-center justify-between">
            <div>
                <span className="corp-eyebrow">{saga.title}</span>
```

### `frontend/src/components/lessons/TopicNode.tsx` (Code)

```typescript
import React from 'react';
import { Check, Lock, Star } from 'lucide-react';

// ============== TYPES ==============

export interface Topic {
    id: number;
    title: string;
    description: string;
    isCompleted: boolean;
    isLocked: boolean;
    type: 'lesson' | 'quiz' | 'milestone'; // Added type for variety
}

// ============== THEME COLORS ==============
```

### `frontend/src/components/lessons/engine/LessonCelebration.tsx` (Code)

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock, ArrowRight, Loader2, Sparkles, Zap, Star, Flame, RotateCcw, LogOut } from "lucide-react";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { DinaCharacter } from "@/components/characters/DinaCharacter";
import DrRhoCharacter from "@/components/characters/DrRhoCharacter";
import ZaraVexCharacter from "@/components/characters/ZaraVexCharacter";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

// ─── Character renderer ───────────────────────────────────────────────────────

function CelebrationCharacter({ characterCode }: { characterCode: string }) {
  switch (characterCode) {
```

### `frontend/src/components/lessons/engine/LessonRunner.tsx` (Code)

```typescript
/**
 * LessonRunner - Motor de Lecciones Dinámico
 * 
 * Diseño UI/UX para LittleFounders:
 * - Header minimalista con progress bar y vidas
 * - Personaje centrado con burbuja de diálogo
 * - Opciones grandes y táctiles
 * - Botón de acción con gradiente morado-amarillo (brand colors)
 * - Modo claro/oscuro 100% compatible
 * - Mobile-first responsive
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
```

### `frontend/src/components/lessons/engine/activities/BillSplitter.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Users, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface BillSplitterProps {
    exercise: any;
    onSubmit: (splits: Record<string, number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const BillSplitter = ({ exercise, onSubmit, onNext, onRetry }: BillSplitterProps) => {
```

### `frontend/src/components/lessons/engine/activities/BudgetBuilder.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Wallet, ShoppingCart, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface BudgetBuilderProps {
    exercise: any;
    onSubmit: (allocation: Record<string, string | number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

// Slider/allocation mode: categories is a non-empty array of objects with an `id`.
```

### `frontend/src/components/lessons/engine/activities/Classification.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface ClassificationProps {
    exercise: any;
    onSubmit: (classifications: Record<string, string>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const Classification = ({ exercise, onSubmit, onNext, onRetry }: ClassificationProps) => {
```

### `frontend/src/components/lessons/engine/activities/CoinCounter.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface CoinCounterProps {
    exercise: any;
    onSubmit: (value: number) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const CoinCounter = ({ exercise, onSubmit, onNext, onRetry }: CoinCounterProps) => {
    const { t } = useTranslation('lessons');
```

### `frontend/src/components/lessons/engine/activities/ConceptBuilder.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowDown, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
// Removed unused dnd import

// NOTE: Using simple click-to-order instead of heavy DnD library for simplicity in this swift implementation if possible.
// Or using native simple swap like Sequencing.tsx.
// Let's reuse Sequencing logic but horizontally/block building style.

interface ConceptBuilderProps {
    exercise: any;
    onSubmit: (sequence: string[]) => boolean;
```

### `frontend/src/components/lessons/engine/activities/CreditScoreBuilder.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { resolveOptions } from './optionSource';

interface CreditScoreBuilderProps {
    exercise: any;
    onSubmit: (decisions: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}
```

### `frontend/src/components/lessons/engine/activities/DebtStrategy.tsx` (Code)

```typescript
import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

interface DebtStrategyProps {
    exercise: any;
    onSubmit: (strategy: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}
```

### `frontend/src/components/lessons/engine/activities/EmergencyFund.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, AlertTriangle, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface EmergencyFundProps {
    exercise: any;
    onSubmit: (decisions: Record<string, string>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const EmergencyFund = ({ exercise, onSubmit, onNext, onRetry }: EmergencyFundProps) => {
```

### `frontend/src/components/lessons/engine/activities/EstimationSlider.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface EstimationSliderProps {
    exercise: any;
    onSubmit: (value: number) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const EstimationSlider = ({ exercise, onSubmit, onNext, onRetry }: EstimationSliderProps) => {
```

### `frontend/src/components/lessons/engine/activities/ExpenseTimeline.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, Clock, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

interface ExpenseTimelineProps {
    exercise: any;
    onSubmit: (order: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const ExpenseTimeline = ({ exercise, onSubmit, onNext, onRetry }: ExpenseTimelineProps) => {
    const { t } = useTranslation('lessons');
```

### `frontend/src/components/lessons/engine/activities/FillBlank.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface FillBlankProps {
    exercise: any;
    onSubmit: (answer: any) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const FillBlank = ({ exercise, onSubmit, onNext, onRetry }: FillBlankProps) => {
```

### `frontend/src/components/lessons/engine/activities/GenericChoice.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractCorrectId } from '../hooks/useLessonState';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

interface GenericChoiceProps {
    exercise: any;
    onSubmit: (answer: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

```

### `frontend/src/components/lessons/engine/activities/GoalRoadmap.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, MapPin, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

interface GoalRoadmapProps {
    exercise: any;
    onSubmit: (order: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const GoalRoadmap = ({ exercise, onSubmit, onNext, onRetry }: GoalRoadmapProps) => {
    const { t } = useTranslation('lessons');
```

### `frontend/src/components/lessons/engine/activities/ImpactMeter.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Heart, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

const HUES = ["indigo", "amber", "emerald", "coral"] as const;

interface ImpactMeterProps {
    exercise: any;
    onSubmit: (causeId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
```

### `frontend/src/components/lessons/engine/activities/InflationSimulator.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface InflationSimulatorProps {
    exercise: any;
    onSubmit: (comparison: { yearStart: number; yearEnd: number }) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const InflationSimulator = ({ exercise, onSubmit, onNext, onRetry }: InflationSimulatorProps) => {
    const { t } = useTranslation('lessons');
```

### `frontend/src/components/lessons/engine/activities/InterestCalculator.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface InterestCalculatorProps {
    exercise: any;
    onSubmit: (values: { principal: number; rate: number; time: number }) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const InterestCalculator = ({ exercise, onSubmit, onNext, onRetry }: InterestCalculatorProps) => {
    const { t } = useTranslation('lessons');
```

### `frontend/src/components/lessons/engine/activities/IntroNarrative.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { QuestButton } from '../ui/QuestButton';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter from '@/components/characters/ZaraVexCharacter';

interface IntroNarrativeProps {
    exercise?: any;
    onNext: () => void;
    isAudioPlaying: boolean;
}

export const IntroNarrative = ({ exercise, onNext, isAudioPlaying }: IntroNarrativeProps) => {
    const { t } = useTranslation('lessons');
```

### `frontend/src/components/lessons/engine/activities/MarketReaction.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Newspaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

interface MarketReactionProps {
    exercise: any;
    onSubmit: (prediction: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MarketReaction = ({ exercise, onSubmit, onNext, onRetry }: MarketReactionProps) => {
```

### `frontend/src/components/lessons/engine/activities/MatchingPairs.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

interface MatchingPairsProps {
    exercise: any;
    onSubmit: (matchedPairs: string[][] | boolean) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MatchingPairs = ({ exercise, onSubmit, onNext, onRetry }: MatchingPairsProps) => {
```

### `frontend/src/components/lessons/engine/activities/MathChallenge.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, Delete, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { resolveOptions } from './optionSource';

interface MathChallengeProps {
    exercise: any;
    onSubmit: (answer: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

```

### `frontend/src/components/lessons/engine/activities/MindsetComparison.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface MindsetComparisonProps {
    exercise: any;
    onSubmit: (choiceId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MindsetComparison = ({ exercise, onSubmit, onNext, onRetry }: MindsetComparisonProps) => {
```

### `frontend/src/components/lessons/engine/activities/MultipleChoice.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractCorrectId } from '../hooks/useLessonState';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';

interface MultipleChoiceProps {
    exercise: any; // Type should be clearer in a real app
    onSubmit: (answer: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MultipleChoice = ({ exercise, onSubmit, onNext, onRetry }: MultipleChoiceProps) => {
```

### `frontend/src/components/lessons/engine/activities/MysteryInvestment.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Plus, Minus, Gift, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface MysteryInvestmentProps {
    exercise: any;
    onSubmit: (allocation: Record<string, number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MysteryInvestment = ({ exercise, onSubmit, onNext, onRetry }: MysteryInvestmentProps) => {
    const { t } = useTranslation('lessons');
```

### `frontend/src/components/lessons/engine/activities/OpportunityCost.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowLeftRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

interface OpportunityCostProps {
    exercise: any;
    onSubmit: (choice: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

```

### `frontend/src/components/lessons/engine/activities/PassiveIncome.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, DollarSign, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface PassiveIncomeProps {
    exercise: any;
    onSubmit: (selected: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const PassiveIncome = ({ exercise, onSubmit, onNext, onRetry }: PassiveIncomeProps) => {
```

### `frontend/src/components/lessons/engine/activities/PortfolioBuilder.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, PieChart, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface PortfolioBuilderProps {
    exercise: any;
    onSubmit: (allocation: Record<string, number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

const COLOR_PALETTE = [
```

### `frontend/src/components/lessons/engine/activities/PriceDetective.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

const HUES = ['indigo', 'amber', 'emerald', 'coral'] as const;

interface PriceDetectiveProps {
    exercise: any;
    onSubmit: (choiceId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
```

### `frontend/src/components/lessons/engine/activities/QuizBattle.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Clock, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';

interface QuizBattleProps {
    exercise: any;
    onSubmit: (score: number) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

```

### `frontend/src/components/lessons/engine/activities/RiskReward.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { ArrowRight, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

interface RiskRewardProps {
    exercise: any;
    onSubmit: (choiceId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

```

### `frontend/src/components/lessons/engine/activities/RoleplayChat.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { OptionCard } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';

interface ChatMessage {
    id: string;
    sender: 'system' | 'hero' | 'npc' | 'user';
    name?: string;
    text: string;
    avatar?: string;
    delay?: number;
```

### `frontend/src/components/lessons/engine/activities/SalaryComparison.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Briefcase, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

interface SalaryComparisonProps {
    exercise: any;
    onSubmit: (selectedId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

```

### `frontend/src/components/lessons/engine/activities/SavingsRace.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Trophy, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface SavingsRaceProps {
    exercise: any;
    onSubmit: (strategy: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const SavingsRace = ({ exercise, onSubmit, onNext, onRetry }: SavingsRaceProps) => {
```

### `frontend/src/components/lessons/engine/activities/Sequencing.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Check, ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface SequencingProps {
    exercise: any;
    onSubmit: (sequence: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const Sequencing = ({ exercise, onSubmit, onNext, onRetry }: SequencingProps) => {
```

### `frontend/src/components/lessons/engine/activities/ShopSim.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ShoppingCart, ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { resolveOptions } from './optionSource';

interface ShopSimProps {
    exercise: any;
    onSubmit: (cartIds: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}
```

### `frontend/src/components/lessons/engine/activities/SpotTheTrap.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, AlertTriangle, ShieldCheck, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface SpotTheTrapProps {
    exercise: any;
    onSubmit: (selectedIds: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const SpotTheTrap = ({ exercise, onSubmit, onNext, onRetry }: SpotTheTrapProps) => {
```

### `frontend/src/components/lessons/engine/activities/StoryMode.tsx` (Code)

```typescript
import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
import DrRhoCharacter, { RhoMood } from '@/components/characters/DrRhoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import ZaraVexCharacter, { ZaraMood } from '@/components/characters/ZaraVexCharacter';
import { normalizeGesture } from '@/utils/gestureMapper';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';
import { extractCorrectId } from '../hooks/useLessonState';

interface StoryPage {
```

### `frontend/src/components/lessons/engine/activities/SubscriptionTracker.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface SubscriptionTrackerProps {
    exercise: any;
    onSubmit: (active: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const SubscriptionTracker = ({ exercise, onSubmit, onNext, onRetry }: SubscriptionTrackerProps) => {
```

### `frontend/src/components/lessons/engine/activities/TapAction.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface TapActionProps {
    exercise: any;
    onSubmit: (items: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

// Playful DS v2 hues, cycled across the tappable tokens.
```

### `frontend/src/components/lessons/engine/activities/TaxPuzzle.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw, Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';

interface TaxPuzzleProps {
    exercise: any;
    onSubmit: (answer: Record<string, number> | string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const TaxPuzzle = ({ exercise, onSubmit, onNext, onRetry }: TaxPuzzleProps) => {
```

### `frontend/src/components/lessons/engine/activities/TrueFalse.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface TrueFalseProps {
    exercise: any;
    onSubmit: (isTrue: boolean) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const TrueFalse = ({ exercise, onSubmit, onNext, onRetry }: TrueFalseProps) => {
```

### `frontend/src/components/lessons/engine/activities/WordScramble.tsx` (Code)

```typescript
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCw, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

interface WordScrambleProps {
    exercise: any;
    onSubmit: (word: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

/** Fisher-Yates shuffle (unbiased) */
```

### `frontend/src/components/lessons/engine/activities/optionSource.ts` (Code)

```typescript
/**
 * optionSource — normalización de la fuente de opciones para actividades tipo "elige una".
 *
 * Muchas actividades (risk_reward, opportunity_cost, salary_comparison, debt_strategy,
 * price_detective, …) leían sus opciones de UNA sola clave de `content` y no renderizaban
 * nada cuando la lección real usaba otra clave o un formato pareado (optionA/optionB).
 *
 * `resolveOptions(content)` devuelve una lista normalizada `{ id, text, ...original }`:
 *  - Para arrays bajo claves conocidas, conserva el `id` original del item.
 *  - Para formas pareadas (optionA/optionB, strategy_a/strategy_b, …), sintetiza ids
 *    de letra ('A'/'B') porque es el esquema que usan los `correct_answer` de esas formas
 *    (correctOption:'A', betterOption:'B', …). El validador central (optionIdMatches) además
 *    tolera diferencias de prefijo/caso.
 *
 * El esquema de id resultante debe coincidir con el que espera `validateAnswer`; por eso se
```

### `frontend/src/components/lessons/engine/components/PopOptionButton.tsx` (Code)

```typescript
import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface PopOptionButtonProps {
    id: string;
    text: React.ReactNode;
    colorTheme?: 'purple' | 'pink' | 'blue' | 'orange' | 'green' | 'amber';
    isSelected: boolean;
    isCorrect?: boolean;
    showResult: boolean;
    feedback: 'none' | 'success' | 'error';
    onClick: () => void;
    disabled?: boolean;
    className?: string;
```

### `frontend/src/components/lessons/engine/hooks/index.ts` (Code)

```typescript
export { useLessonData, completeLesson, getNextLessonCode, fetchNextLessonCode } from './useLessonData';
export type { LessonData, ExerciseData, LessonInfo, LessonMeta, AudioData, AudioSegment, AudioSegmentMap } from './useLessonData';

export { useLessonState } from './useLessonState';
export type { LessonState, UseLessonStateReturn } from './useLessonState';

export { useLessonAudio } from './useLessonAudio';
export type { UseLessonAudioReturn } from './useLessonAudio';
```

### `frontend/src/components/lessons/engine/hooks/useLessonAudio.ts` (Code)

```typescript
/**
 * useLessonAudio - Hook para gestionar audio narrativo granular en lecciones
 *
 * Maneja la reproduccion de audio por sub-elementos del ejercicio:
 * - Al cargar un ejercicio: reproduce main/statement/question/instruction en secuencia
 * - Al responder: reproduce feedback_success o feedback_error
 *
 * Diseño de resiliencia:
 * - Si un segmento no existe en la DB → se omite silenciosamente, la lección continúa
 * - Si el URL del audio da error 404/red → se omite silenciosamente, continúa la cola
 * - Si el navegador bloquea autoplay → se omite silenciosamente
 * - Si el componente se desmonta durante la reproducción → limpieza sin warnings
 * - Si audioMuted cambia durante la reproducción → se detiene correctamente
 *
 * Nota: Este hook NO reemplaza los SFX del SoundContext (edu_success, edu_error).
```

### `frontend/src/components/lessons/engine/hooks/useLessonData.ts` (Code)

```typescript
/**
 * Hook para obtener datos de lección desde el backend
 * Soporte para internacionalización (i18n)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

/**
 * Represents a single audio segment for a specific sub-element of an exercise.
 */
export interface AudioSegment {
    url: string | null;
    duration_ms?: number;
```

### `frontend/src/components/lessons/engine/hooks/useLessonState.ts` (Code)

```typescript
/**
 * Hook para manejar el estado de la lección (máquina de estados)
 *
 * VALIDACIÓN CENTRALIZADA: Este hook es la ÚNICA fuente de verdad para
 * determinar si una respuesta es correcta o incorrecta. Los componentes
 * de actividad NO deben validar por su cuenta - deben enviar la respuesta
 * cruda a submitAnswer() y usar el valor de retorno para determinar feedback.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ExerciseData, LessonData } from './useLessonData';

export type LessonState =
    | 'IDLE'           // Esperando iniciar
    | 'PLAYING'        // Reproduciendo audio/narración
    | 'WAITING_INPUT'  // Esperando respuesta del usuario
```

### `frontend/src/components/lessons/engine/index.ts` (Code)

```typescript
// Lesson Engine - Main exports
export { LessonRunner } from './LessonRunner';
export * from './hooks';
export * from './stages';
```

### `frontend/src/components/lessons/engine/stages/IntroNarrativeStage.tsx` (Code)

```typescript
/**
 * IntroNarrativeStage - Muestra una narración con el personaje
 */
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { ExerciseData } from '../hooks/useLessonData';

interface IntroNarrativeStageProps {
    exercise: ExerciseData;
    onComplete: () => void;
    isTalking?: boolean;
}

export function IntroNarrativeStage({ exercise, onComplete, isTalking = false }: IntroNarrativeStageProps) {
```

### `frontend/src/components/lessons/engine/stages/MultipleChoiceStage.tsx` (Code)

```typescript
/**
 * MultipleChoiceStage - Pregunta con opciones múltiples
 */
import { useState, useEffect } from 'react';
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExerciseData } from '../hooks/useLessonData';

interface MultipleChoiceStageProps {
    exercise: ExerciseData;
    onAnswer: (answerId: string) => boolean;
    onComplete: () => void;
    feedbackState: 'none' | 'success' | 'error';
```

### `frontend/src/components/lessons/engine/stages/index.ts` (Code)

```typescript
export { IntroNarrativeStage } from './IntroNarrativeStage';
export { MultipleChoiceStage } from './MultipleChoiceStage';
```

### `frontend/src/components/lessons/engine/ui/CoinBurst.tsx` (Code)

```typescript
/**
 * Playful DS v2 — CoinBurst.
 * Celebratory coin particle burst fired on a correct answer. Re-fires whenever
 * `burstKey` increments. Renders inside a position:relative parent.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Coins } from "lucide-react";

const N = 14;

export function CoinBurst({ burstKey }: { burstKey: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible">
      <AnimatePresence>
        {burstKey > 0 && (
```

### `frontend/src/components/lessons/engine/ui/OptionCard.tsx` (Code)

```typescript
/**
 * Playful DS v2 — OptionCard.
 * A tactile "token" answer option: chunky, colored index coin, springy press,
 * warm correct/wrong states. Shared by multiple-choice, true/false, etc.
 */
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "dimmed";

const HUES = ["indigo", "amber", "emerald", "coral"] as const;

interface OptionCardProps {
  index: number;
```

### `frontend/src/components/lessons/engine/ui/QuestButton.tsx` (Code)

```typescript
/**
 * Playful DS v2 — QuestButton.
 * The chunky tactile action button (gold "treasure" by default; emerald on
 * success-continue, coral on retry, indigo for neutral/brand actions).
 */
import { cn } from "@/lib/utils";

type Variant = "gold" | "go" | "retry" | "brand";

interface QuestButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: Variant;
  className?: string;
```

### `frontend/src/components/lessons/engine/ui/QuestProgress.tsx` (Code)

```typescript
/**
 * Playful DS v2 — QuestProgress (lesson top bar).
 * Close button, springy gold progress track, coin purse, and hearts.
 */
import { motion } from "framer-motion";
import { X, Heart, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { spring } from "./motion";

interface QuestProgressProps {
  value: number; // 0..1
  coins: number;
  hearts: number;
  maxHearts?: number;
  onClose?: () => void;
```

### `frontend/src/components/lessons/engine/ui/motion.ts` (Code)

```typescript
/**
 * Playful DS v2 — motion presets (framer-motion).
 * Spring-physics vocabulary shared by every lesson primitive so the whole
 * engine feels like one tactile, alive world.
 */
import type { Variants, Transition } from "framer-motion";

export const spring: Transition = { type: "spring", stiffness: 520, damping: 30, mass: 0.8 };
export const softSpring: Transition = { type: "spring", stiffness: 240, damping: 22 };
export const popSpring: Transition = { type: "spring", stiffness: 600, damping: 17 };

/** Parent that staggers children reveals. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
```

### `frontend/src/components/lessons/hooks/useAdventures.ts` (Code)

```typescript
/**
 * Hook para obtener aventuras desde el API con soporte i18n
 * Reemplaza el hook estático anterior
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

export interface Adventure {
    id: number;
    code: string;
    title: string;
    ageRange: string;
    description: string;
```

### `frontend/src/components/lessons/hooks/useLessonsList.ts` (Code)

```typescript
/**
 * Hook para obtener lecciones de una aventura/saga/topic.
 * For guest users (no userId), completed status is overlaid from localStorage
 * so that /learn shows accurate progress without a backend user account.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getGuestProfile } from '@/lib/guestProfile';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

export interface LessonItem {
    id: number;
    code: string;
    title: string;
```

### `frontend/src/components/lessons/hooks/useResumeLesson.ts` (Code)

```typescript
import { useState, useEffect } from 'react';
import { getGuestProfile } from '@/lib/guestProfile';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

export function useResumeLesson(userId?: string) {
    const [nextLessonCode, setNextLessonCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        // ── Guest path: read next lesson pointer from localStorage ──────────
        // Guests have no backend account, so progress is tracked in lf_guest_profile.
        // LessonRunner saves next_lesson_code there after each completion.
        if (!userId) {
```

### `frontend/src/components/lessons/hooks/useSagaData.ts` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Topic } from '../TopicNode';

export interface SagaData {
    id: number;
    title: string;
    subtitle: string;
    theme: 'amber' | 'blue' | 'emerald' | 'rose' | 'purple';
    description: string;
    topics: Topic[];
}

export interface NextAdventureData {
    id: number;
```

### `frontend/src/components/showreel/ShowreelComposition.tsx` (Code)

```typescript
import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Img,
} from "remotion";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { DinaCharacter } from "@/components/characters/DinaCharacter";
import { DrRhoCharacter } from "@/components/characters/DrRhoCharacter";
import { ZaraVexCharacter } from "@/components/characters/ZaraVexCharacter";

// ─── Props ────────────────────────────────────────────────────────────────────
```

### `frontend/src/components/showreel/ShowreelPlayer.tsx` (Code)

```typescript
import React, { useEffect, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
    ShowreelComposition,
    TOTAL_FRAMES_SHOWREEL,
    type ShowreelProps,
} from "./ShowreelComposition";

// 1920x1080 cinematic canvas
const COMP_W = 1920;
const COMP_H = 1080;
const FPS_DESKTOP = 30;
const FPS_MOBILE = 15;
```

### `frontend/src/components/social/UserConnectionsList.tsx` (Code)

```typescript
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { UserPublicProfile } from "../../lib/api/social";
import { useNavigate } from "react-router-dom";
import { Users, Star, Flame, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserConnectionsListProps {
  users: UserPublicProfile[];
  emptyMessage?: string;
  className?: string;
}

export function UserConnectionsList({ 
  users, 
  emptyMessage = "No se encontraron usuarios",
```

### `frontend/src/components/theme/ThemeProvider.tsx` (Code)

```typescript
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

```

### `frontend/src/components/theme/ThemeToggle.tsx` (Code)

```typescript
import React from 'react';
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const options = [
        { id: 'system', icon: Monitor, label: 'Sistema', color: 'text-blue-500' },
        { id: 'light', icon: Sun, label: 'Claro', color: 'text-blue-500' },
        { id: 'dark', icon: Moon, label: 'Oscuro', color: 'text-indigo-500' },
    ];

    const activeIndex = options.findIndex(opt => opt.id === theme);
```

### `frontend/src/components/transitions/AnimatedRoutes.tsx` (Code)

```typescript
import React, { useState, useLayoutEffect } from "react";
import { useLocation, Routes } from "react-router-dom";
import { flushSync } from "react-dom";

interface AnimatedRoutesProps {
  children: React.ReactNode;
}

export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);

  useLayoutEffect(() => {
    // If the path hasn't changed, we don't need a view transition
    if (location.pathname === displayLocation.pathname && location.search === displayLocation.search) {
```

### `frontend/src/components/ui/AssetImg.tsx` (Code)

```typescript
import { useAsset } from '@/hooks/useAsset';

interface AssetImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Path relative to the game-assets Supabase bucket root */
  assetPath: string | null | undefined;
  /** Rendered while the blob URL is loading or if auth fails */
  fallback?: React.ReactNode;
}

/**
 * Renders an image from a private Supabase bucket using a signed + blob URL.
 * The real asset URL is never exposed in the DOM or DevTools element inspector.
 */
export function AssetImg({ assetPath, fallback = null, ...props }: AssetImgProps) {
  const src = useAsset(assetPath);
```

### `frontend/src/components/ui/LanguageSelector.tsx` (Code)

```typescript
/**
 * LanguageSelector Component
 * 
 * A dropdown component for switching between available languages.
 * Can be placed in navigation, settings, or footer.
 * 
 * Features:
 * - Syncs with backend for authenticated users
 * - Persists to localStorage for anonymous users
 * 
 * Usage:
 * ```tsx
 * <LanguageSelector />
 * <LanguageSelector variant="minimal" />
 * ```
```

### `frontend/src/components/ui/LoadingScreen.tsx` (Code)

```typescript
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface LoadingScreenProps {
  title?: string;
  description?: string;
  loadingMessage: string;
  icon?: React.ReactNode;
  className?: string;
  minimal?: boolean;
}

export function LoadingScreen({
  title,
  description,
```

### `frontend/src/components/ui/SpeechBubble.tsx` (Code)

```typescript
import { cn } from "@/lib/utils";

interface SpeechBubbleProps {
    children: React.ReactNode;
    show?: boolean;
    className?: string;
    position?: 'top' | 'bottom' | 'top-left' | 'top-right';
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Modern speech bubble component matching the LittleFounders design system.
 * Features: Pill-shaped, soft shadow, smooth pointer, responsive.
 */
export function SpeechBubble({
```

### `frontend/src/components/ui/StreakCelebration.tsx` (Code)

```typescript
/**
 * StreakCelebration — Cinematic full-screen immersive streak celebration
 *
 * Duolingo-level production quality with:
 * - Full-screen immersive experience (not a modal)
 * - Cinematic background with animated gradients and light rays
 * - Massive flame animation with glow effects
 * - Huge animated streak number with shadow/blur
 * - Per-character kinetic typography
 * - Particle rain (confetti, embers, sparkles) everywhere
 * - Screen shake effect on entry
 * - Complex animation timeline with staggered effects
 * - Multiple sound layers
 * - Pulsing ring expansion from center
 * - Light effects and corona glows
```

### `frontend/src/components/ui/accordion.tsx` (Code)

```typescript
import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)}
```

### `frontend/src/components/ui/alert-dialog.tsx` (Code)

```typescript
import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
```

### `frontend/src/components/ui/alert.tsx` (Code)

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
```

### `frontend/src/components/ui/aspect-ratio.tsx` (Code)

```typescript
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

const AspectRatio = AspectRatioPrimitive.Root

export { AspectRatio }
```

### `frontend/src/components/ui/avatar.tsx` (Code)

```typescript
import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
```

### `frontend/src/components/ui/badge.tsx` (Code)

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
```

### `frontend/src/components/ui/breadcrumb.tsx` (Code)

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />)
Breadcrumb.displayName = "Breadcrumb"

const BreadcrumbList = React.forwardRef<
```

### `frontend/src/components/ui/button.tsx` (Code)

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useSound } from "@/contexts/SoundContext";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-button hover:shadow-button-hover active:shadow-button-active active:translate-y-1",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl shadow-button hover:shadow-button-hover active:shadow-button-active active:translate-y-1",
```

### `frontend/src/components/ui/calendar.tsx` (Code)

```typescript
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
```

### `frontend/src/components/ui/card.tsx` (Code)

```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl liquid-glass",
      className
    )}
    {...props}
```

### `frontend/src/components/ui/carousel.tsx` (Code)

```typescript
import * as React from "react"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
```

### `frontend/src/components/ui/chart.tsx` (Code)

```typescript
import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
```

### `frontend/src/components/ui/checkbox.tsx` (Code)

```typescript
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
```

### `frontend/src/components/ui/collapsible.tsx` (Code)

```typescript
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
```

### `frontend/src/components/ui/command.tsx` (Code)

```typescript
import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
```

### `frontend/src/components/ui/context-menu.tsx` (Code)

```typescript
import * as React from "react"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const ContextMenu = ContextMenuPrimitive.Root

const ContextMenuTrigger = ContextMenuPrimitive.Trigger

const ContextMenuGroup = ContextMenuPrimitive.Group

const ContextMenuPortal = ContextMenuPrimitive.Portal

const ContextMenuSub = ContextMenuPrimitive.Sub
```

### `frontend/src/components/ui/date-picker.tsx` (Code)

```typescript
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type DatePickerView = 'years' | 'months' | 'days';

interface DatePickerProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
```

### `frontend/src/components/ui/dialog.tsx` (Code)

```typescript
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
```

### `frontend/src/components/ui/drawer.tsx` (Code)

```typescript
import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
)
Drawer.displayName = "Drawer"
```

### `frontend/src/components/ui/dropdown-menu.tsx` (Code)

```typescript
import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub
```

### `frontend/src/components/ui/error-boundary.tsx` (Code)

```typescript
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
```

### `frontend/src/components/ui/form.tsx` (Code)

```typescript
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import {
  Controller,
  ControllerProps,
  FieldPath,
  FieldValues,
  FormProvider,
  useFormContext,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

```

### `frontend/src/components/ui/hover-card.tsx` (Code)

```typescript
import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/utils"

const HoverCard = HoverCardPrimitive.Root

const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Portal>
    <HoverCardPrimitive.Content
```

### `frontend/src/components/ui/input-otp.tsx` (Code)

```typescript
import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { Dot } from "lucide-react"

import { cn } from "@/lib/utils"

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName
```

### `frontend/src/components/ui/input.tsx` (Code)

```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
```

### `frontend/src/components/ui/label.tsx` (Code)

```typescript
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
```

### `frontend/src/components/ui/menubar.tsx` (Code)

```typescript
import * as React from "react"
import * as MenubarPrimitive from "@radix-ui/react-menubar"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const MenubarMenu = MenubarPrimitive.Menu

const MenubarGroup = MenubarPrimitive.Group

const MenubarPortal = MenubarPrimitive.Portal

const MenubarSub = MenubarPrimitive.Sub

const MenubarRadioGroup = MenubarPrimitive.RadioGroup
```

### `frontend/src/components/ui/navigation-menu.tsx` (Code)

```typescript
import * as React from "react"
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { cva } from "class-variance-authority"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn(
      "relative z-10 flex max-w-max flex-1 items-center justify-center",
```

### `frontend/src/components/ui/pagination.tsx` (Code)

```typescript
import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/components/ui/button"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
)
Pagination.displayName = "Pagination"
```

### `frontend/src/components/ui/popover.tsx` (Code)

```typescript
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
```

### `frontend/src/components/ui/progress.tsx` (Code)

```typescript
import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
```

### `frontend/src/components/ui/radio-group.tsx` (Code)

```typescript
import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
```

### `frontend/src/components/ui/resizable.tsx` (Code)

```typescript
import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
```

### `frontend/src/components/ui/scroll-area.tsx` (Code)

```typescript
import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
```

### `frontend/src/components/ui/select.tsx` (Code)

```typescript
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
```

### `frontend/src/components/ui/separator.tsx` (Code)

```typescript
import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
```

### `frontend/src/components/ui/sheet.tsx` (Code)

```typescript
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

```

### `frontend/src/components/ui/sidebar.tsx` (Code)

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
```

### `frontend/src/components/ui/skeleton.tsx` (Code)

```typescript
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

### `frontend/src/components/ui/slider.tsx` (Code)

```typescript
import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
```

### `frontend/src/components/ui/sonner.tsx` (Code)

```typescript
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
```

### `frontend/src/components/ui/switch.tsx` (Code)

```typescript
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
```

### `frontend/src/components/ui/table.tsx` (Code)

```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
```

### `frontend/src/components/ui/tabs.tsx` (Code)

```typescript
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-12 items-center justify-center rounded-2xl p-1.5 liquid-glass-subtle",
```

### `frontend/src/components/ui/textarea.tsx` (Code)

```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
```

### `frontend/src/components/ui/toast.tsx` (Code)

```typescript
import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
```

### `frontend/src/components/ui/toaster.tsx` (Code)

```typescript
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
```

### `frontend/src/components/ui/toggle-group.tsx` (Code)

```typescript
import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

const ToggleGroup = React.forwardRef<
```

### `frontend/src/components/ui/toggle.tsx` (Code)

```typescript
import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
```

### `frontend/src/components/ui/tooltip.tsx` (Code)

```typescript
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
```

### `frontend/src/components/ui/use-toast.ts` (Code)

```typescript
import { useToast, toast } from "@/hooks/use-toast";

export { useToast, toast };
```

### `frontend/src/config/api.ts` (Code)

```typescript
// API Configuration
// VITE_API_URL should be set in Vercel's Environment Variables to the Railway backend URL.
// e.g. https://littlefounders-backend-production.up.railway.app
// In local development it falls back to localhost:8000
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default API_URL;

```

### `frontend/src/contexts/SoundContext.tsx` (Code)

```typescript
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Howl, Howler } from 'howler';
import { resolveAudioSrc } from '@/lib/assets';

// Define sound types based on our design
type SoundType =
    | 'ui_tap'
    | 'ui_toggle'
    | 'nav_slide'
    | 'auth_success'
    | 'auth_error'
    | 'auth_bye'
    | 'edu_success'
    | 'edu_error'
    | 'edu_complete'
```

### `frontend/src/features/placement/PlacementEngine.tsx` (Code)

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { updateGuestProfile } from '@/lib/guestProfile';
import { trackEvent } from '@/lib/analytics';
import type { PlacementState } from './types';
import { ageToAdventure, selectNextItem, shouldStop, computePlacementResult } from './scoring/engine';
import { PlacementIntroScreen } from './components/PlacementIntroScreen';
import { PlacementQuestion } from './components/PlacementQuestion';
import { PlacementProgressBar } from './components/PlacementProgressBar';
import { PlacementClosingScreen } from './components/PlacementClosingScreen';

const MAX_ITEMS = 12;

```

### `frontend/src/features/placement/bank/items.ts` (Code)

```typescript
import type { PlacementItem } from '../types';

// ─── Adventure 2 (ages 8–9) ──────────────────────────────────────────────────

const A2_ITEMS: PlacementItem[] = [
  {
    id: 'P-A2-NUM-001',
    adventure: 2, saga: 1, dimension: 'numeracy', difficulty: 2,
    type: 'multiple_choice',
    question_es: 'Si tienes $20 y te dan $15 más, ¿cuánto dinero tienes en total?',
    question_en: 'If you have $20 and someone gives you $15 more, how much money do you have?',
    options_es: ['$25', '$35', '$40', '$30'],
    options_en: ['$25', '$35', '$40', '$30'],
    correct_index: 1,
    expected_time_sec: 10,
```

### `frontend/src/features/placement/components/PlacementClosingScreen.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Star } from 'lucide-react';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { StreakCelebration } from '@/components/ui/StreakCelebration';
import type { PlacementResult } from '@/lib/guestProfile';

interface Props {
  result: PlacementResult | null;
  name: string;
  onContinue: () => void;
}

export function PlacementClosingScreen({ result, name, onContinue }: Props) {
  const { t } = useTranslation('placement');
```

### `frontend/src/features/placement/components/PlacementIntroScreen.tsx` (Code)

```typescript
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';

interface Props {
  name: string;
  onAccept: () => void;
  onSkip: () => void;
}

export function PlacementIntroScreen({ name, onAccept, onSkip }: Props) {
  const { t, i18n } = useTranslation('placement');
  const audioRef = useRef<HTMLAudioElement | null>(null);

```

### `frontend/src/features/placement/components/PlacementProgressBar.tsx` (Code)

```typescript
interface Props {
  current: number;
  max: number;
  isFinishing?: boolean;
}

export function PlacementProgressBar({ current, max, isFinishing }: Props) {
  const pct = isFinishing ? 100 : Math.min(Math.round((current / max) * 100), 95);

  return (
    <div className="relative z-10 w-full px-6 pt-6 pb-1 max-w-lg mx-auto">
      <div className="relative w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
```

### `frontend/src/features/placement/components/PlacementQuestion.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import type { PlacementItem } from '../types';

// Neutral feedback phrases — pooled to avoid repetition
const FEEDBACK_ES = [
  '¡Sigamos adelante!',
  '¡Interesante! Siguiente.',
  '¡Muy bien! Continuemos.',
  '¡Vamos por más!',
  '¡Excelente! Próxima pregunta.',
  '¡Eso es! Seguimos.',
  '¡Genial! Vamos.',
```

### `frontend/src/features/placement/scoring/engine.ts` (Code)

```typescript
import type { PlacementItem, PlacementDimension, AdventureLevel, PlacementResponse } from '../types';
import type { PlacementResult } from '@/lib/guestProfile';
import { ALL_ITEMS } from '../bank/items';

// ─── Age → Adventure mapping ─────────────────────────────────────────────────

export function ageToAdventure(age: number): AdventureLevel {
  if (age <= 9) return 2;
  if (age <= 12) return 3;
  if (age <= 14) return 4;
  if (age <= 17) return 5;
  return 6;
}

// ─── Applicable dimensions by adventure ─────────────────────────────────────
```

### `frontend/src/features/placement/types.ts` (Code)

```typescript
export type PlacementDimension = 'numeracy' | 'saving' | 'investing' | 'security';
export type AdventureLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface PlacementItem {
  id: string;
  adventure: AdventureLevel;
  saga: number;
  dimension: PlacementDimension;
  difficulty: 1 | 2 | 3 | 4 | 5;
  type: 'multiple_choice' | 'true_false';
  question_es: string;
  question_en: string;
  /** Required when type === 'multiple_choice' */
  options_es?: string[];
  options_en?: string[];
```

### `frontend/src/games/chronobloom/ChronoBloomPage.tsx` (Code)

```typescript
import './chronobloom.css';
import ChronoBloomGame from './components/ChronoBloomGame';

export default function ChronoBloomPage() {
  return <ChronoBloomGame />;
}
```

### `frontend/src/games/chronobloom/chronobloom.css` (Code)

```css
@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Orbitron:wght@400;700;900&family=Nunito:wght@400;600;700;900&display=swap');

/* ─── Full Screen ──────────────────────────────────────────────────────────── */
.cb-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #060e08;
  overflow: hidden;
  font-family: 'Nunito', sans-serif;
  -webkit-user-select: none;
  user-select: none;
}

/* ─── Scale Wrapper ──────────────────────────────────────────────────────── */
```

### `frontend/src/games/chronobloom/components/ChronoBloomGame.tsx` (Code)

```typescript
import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

import { gameReducer, createInitialState } from '../gameReducer';
import {
  GAME_CONFIG, AUDIO, CANVAS_W, CANVAS_H, HUD_H, TOOLBAR_H,
  canvasToGrid, getCellCenter,
} from '../constants';
import type { PlantType } from '../types';

import GameCanvas from './GameCanvas';
import GameHUD from './GameHUD';
import PlantToolbar from './PlantToolbar';
import PlantInfoPanel from './PlantInfoPanel';
```

### `frontend/src/games/chronobloom/components/GameCanvas.tsx` (Code)

```typescript
import { useRef, useEffect } from 'react';
import type { GameState, Plant, Enemy, PlantType } from '../types';
import {
  CANVAS_W, CANVAS_H, MAP_Y, MAP_H, GREENHOUSE_W,
  CELL_W, CELL_H, GRID_COLS, GRID_ROWS, PLANT_DEFS, ENEMY_DEFS,
  getCellCenter,
} from '../constants';

interface Props {
  state: GameState;
  hoveredCell: { col: number; row: number } | null;
  onClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave: () => void;
}
```

### `frontend/src/games/chronobloom/components/GameHUD.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  onPause: () => void;
}

export default function GameHUD({ state, onPause }: Props) {
  const { t } = useTranslation('chronoBloom');

  const hpPct = state.greenhouseHp / state.maxGreenhouseHp;
  const hpColor =
    hpPct > 0.5 ? '#4ade80' :
```

### `frontend/src/games/chronobloom/components/GameOverScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export default function GameOverScreen({ state, onRestart }: Props) {
  const { t } = useTranslation('chronoBloom');

  const allStats = state.allStats.flat();
  const totalInterest = allStats.reduce((s, y) => s + y.interestEarned, 0);
  const totalEnemies = allStats.reduce((s, y) => s + y.enemiesDefeated, 0);

```

### `frontend/src/games/chronobloom/components/GameStartScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onStart: () => void;
}

const ENEMY_PREVIEWS = [
  { emoji: '🐜', nameKey: 'enemies.ant_expense.name', color: '#78350f' },
  { emoji: '👹', nameKey: 'enemies.impulsive_beast.name', color: '#ef4444' },
  { emoji: '🎈', nameKey: 'enemies.inflation_zeppelin.name', color: '#f59e0b' },
  { emoji: '👑', nameKey: 'enemies.deficit_king.name', color: '#7c3aed' },
];

```

### `frontend/src/games/chronobloom/components/LevelCompleteScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  onNext: () => void;
}

function getStars(state: GameState): number {
  const hpPct = state.greenhouseHp / state.maxGreenhouseHp;
  const data = state.yearResultData;
  const totalInterest = state.allStats[state.level - 1]?.reduce((s, y) => s + y.interestEarned, 0) ?? 0;
  if (hpPct >= 0.7 && state.liquidatedEarly === 0) return 3;
  if (hpPct >= 0.4 && totalInterest > 0) return 2;
```

### `frontend/src/games/chronobloom/components/PauseOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';

interface Props {
  onResume: () => void;
  onRestart: () => void;
}

export default function PauseOverlay({ onResume, onRestart }: Props) {
  const { t } = useTranslation('chronoBloom');

  return (
    <div className="cb-overlay">
      <div className="cb-pause-card">
        <div style={{ fontSize: 40, marginBottom: 10 }}>⏸</div>
        <div className="cb-card-title">{t('pause.title')}</div>
```

### `frontend/src/games/chronobloom/components/PlantInfoPanel.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState, Plant } from '../types';
import { PLANT_DEFS, GAME_CONFIG, getCellCenter, CANVAS_W, CANVAS_H, HUD_H, TOOLBAR_H } from '../constants';

interface Props {
  plant: Plant;
  state: GameState;
  scale: number;
  onLiquidate: () => void;
  onUnfreeze: () => void;
  onClose: () => void;
}

export default function PlantInfoPanel({ plant, state, scale, onLiquidate, onUnfreeze, onClose }: Props) {
  const { t } = useTranslation('chronoBloom');
```

### `frontend/src/games/chronobloom/components/PlantToolbar.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState, PlantType } from '../types';
import { PLANT_DEFS, GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  onSelectPlant: (type: PlantType | null) => void;
  onAdvanceYear: () => void;
}

const PLANT_ORDER: PlantType[] = ['savings_sprout', 'stock_tree', 'div_vine', 'emergency_cactus'];

export default function PlantToolbar({ state, onSelectPlant, onAdvanceYear }: Props) {
  const { t } = useTranslation('chronoBloom');

```

### `frontend/src/games/chronobloom/components/PonziOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GAME_CONFIG } from '../constants';

interface Props {
  onDecline: () => void;
  onAccept: () => void;
  capital: number;
}

export default function PonziOverlay({ onDecline, onAccept, capital }: Props) {
  const { t } = useTranslation('chronoBloom');
  const canAfford = capital >= GAME_CONFIG.ponziCapitalCost;

  return (
    <div className="cb-overlay" style={{ zIndex: 55 }}>
```

### `frontend/src/games/chronobloom/components/TutorialOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onNext: () => void;
  onSkip: () => void;
}

const STEPS = [
  {
    titleKey: 'tutorial.step0.title',
    descKey: 'tutorial.step0.desc',
    emoji: '🌱',
    zelda: true,
```

### `frontend/src/games/chronobloom/components/VictoryScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onPlayAgain: () => void;
}

function getOverallStars(state: GameState): number {
  const allYearStats = state.allStats.flat();
  const hpPct = state.greenhouseHp / state.maxGreenhouseHp;
  const totalInterest = allYearStats.reduce((s, y) => s + y.interestEarned, 0);
  const totalStolen = allYearStats.reduce((s, y) => s + y.capitalStolenByEnemies, 0);
  if (hpPct >= 0.6 && state.liquidatedEarly === 0 && totalStolen < 200) return 3;
  if (hpPct >= 0.3 && totalInterest > 0) return 2;
```

### `frontend/src/games/chronobloom/components/YearResultScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState, PlantType } from '../types';
import { PLANT_DEFS } from '../constants';

interface Props {
  state: GameState;
  onContinue: () => void;
}

function plantEmoji(type: PlantType) {
  return PLANT_DEFS[type].emoji;
}

export default function YearResultScreen({ state, onContinue }: Props) {
  const { t } = useTranslation('chronoBloom');
```

### `frontend/src/games/chronobloom/constants.ts` (Code)

```typescript
import type { PlantType, EnemyType, YearWave } from './types';

// ─── Asset Base Path (relative to game-assets bucket) ────────────────────────
const BASE = '8-chronobloom';

export const AUDIO = {
  bgm:         `${BASE}/audio/bgm.mp3`,
  bgmBoss:     `${BASE}/audio/bgm-boss.mp3`,
  bgmVictory:  `${BASE}/audio/bgm-victory.mp3`,
  plantPlace:  `${BASE}/audio/plant-place.mp3`,
  plantLevelUp:`${BASE}/audio/plant-level-up.mp3`,
  plantSell:   `${BASE}/audio/plant-sell.mp3`,
  coinCollect: `${BASE}/audio/coin-collect.mp3`,
  coinShoot:   `${BASE}/audio/coin-shoot.mp3`,
  enemyKill:   `${BASE}/audio/enemy-kill.mp3`,
```

### `frontend/src/games/chronobloom/gameReducer.ts` (Code)

```typescript
import type {
  GameState, GameAction, Plant, Enemy, Projectile, Particle,
  CapitalDrop, FloatingNumber, YearStats, YearResultData, EnemySpawn, EnemyType
} from './types';
import {
  PLANT_DEFS, ENEMY_DEFS, LEVEL_WAVES, GAME_CONFIG, getCellCenter,
  CANVAS_W, MAP_Y, CELL_H, CELL_W, GREENHOUSE_W,
  getEnemyHpMultiplier
} from './constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _eid = 0;
const uid = () => `e${++_eid}_${Date.now()}`;

function makeInitialYearStats(level: number, year: number, capital: number): YearStats {
```

### `frontend/src/games/chronobloom/index.ts` (Code)

```typescript
export { default } from './ChronoBloomPage';
```

### `frontend/src/games/chronobloom/types.ts` (Code)

```typescript
// ─── Game Phases ────────────────────────────────────────────────────────────
export type GamePhase =
  | 'START'
  | 'TUTORIAL'
  | 'PLANNING'
  | 'PLAYING'
  | 'YEAR_RESULT'
  | 'LEVEL_COMPLETE'
  | 'VICTORY'
  | 'GAME_OVER'
  | 'PAUSED';

// ─── Plant Types ─────────────────────────────────────────────────────────────
export type PlantType =
  | 'savings_sprout'
```

### `frontend/src/games/hacker-defense/HackerDefensePage.tsx` (Code)

```typescript
import './hacker-defense.css';
import HackerDefenseGame from './components/HackerDefenseGame';

export default function HackerDefensePage() {
  return <HackerDefenseGame />;
}
```

### `frontend/src/games/hacker-defense/components/BossPopupOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { BossPopupState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  popups: BossPopupState[];
  onClose: (id: string) => void;
}

// Fake popup content variants
const POPUP_VARIANTS = [
  { icon: '🏆', titleKey: 'hackerDefense:bossPopup.title1', bodyKey: 'hackerDefense:bossPopup.body1' },
  { icon: '💰', titleKey: 'hackerDefense:bossPopup.title2', bodyKey: 'hackerDefense:bossPopup.body2' },
  { icon: '🔔', titleKey: 'hackerDefense:bossPopup.title3', bodyKey: 'hackerDefense:bossPopup.body3' },
];
```

### `frontend/src/games/hacker-defense/components/GameHUD.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  onPause: () => void;
}

export default function GameHUD({ state, onPause }: Props) {
  const { t } = useTranslation('games');

  const { bankBalance, maxBankBalance, score, wave, level } = state;
  const balancePct = bankBalance / maxBankBalance;
  const isDanger = balancePct < 0.2;
```

### `frontend/src/games/hacker-defense/components/GameMap.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState, TowerType } from '../types';
import {
  PATH_WAYPOINTS,
  TOWER_DEFS,
  UPGRADE_COSTS,
  GAME_CONFIG,
  CANVAS_H,
  CANVAS_W,
  HUD_H,
  TOOLBAR_H,
} from '../constants';

interface Props {
  state: GameState;
```

### `frontend/src/games/hacker-defense/components/GameOverScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export default function GameOverScreen({ state, onRestart }: Props) {
  const { t } = useTranslation('games');

  const isNewHighScore = state.score > 0 && state.score >= state.highScore;

  return (
    <div className="hd-overlay">
```

### `frontend/src/games/hacker-defense/components/GameStartScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onStart: () => void;
}

export default function GameStartScreen({ state, onStart }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="hd-start-bg">
      {/* Animated background dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
```

### `frontend/src/games/hacker-defense/components/HackerDefenseGame.tsx` (Code)

```typescript
import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

import { gameReducer, createInitialState } from '../gameReducer';
import { GAME_CONFIG, AUDIO } from '../constants';
import type { TowerType } from '../types';

import GameStartScreen from './GameStartScreen';
import TutorialOverlay from './TutorialOverlay';
import InboxPhase from './InboxPhase';
import GameHUD from './GameHUD';
import GameMap from './GameMap';
import TowerToolbar from './TowerToolbar';
import TwoFAPrompt from './TwoFAPrompt';
```

### `frontend/src/games/hacker-defense/components/InboxPhase.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { InboxEmail } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  email: InboxEmail | null;
  timer: number;
  level: number;
  inboxDecision: 'phishing' | 'trust' | null;
  onPreviewDecide: (decision: 'phishing' | 'trust') => void;
}

export default function InboxPhase({ email, timer, level, inboxDecision, onPreviewDecide }: Props) {
  const { t } = useTranslation('games');

```

### `frontend/src/games/hacker-defense/components/LevelResult.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { LevelStats } from '../types';
import { getRank } from '../constants';

interface Props {
  level: number;
  stats: LevelStats;
  maxBalance: number;
  score: number;
  isVictory?: boolean;
  onNext: () => void;
  onRestart: () => void;
}

export default function LevelResult({ level, stats, maxBalance, score, isVictory, onNext, onRestart }: Props) {
```

### `frontend/src/games/hacker-defense/components/PauseOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';

interface Props {
  onResume: () => void;
  onRestart: () => void;
}

export default function PauseOverlay({ onResume, onRestart }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="hd-overlay">
      <div className="hd-card" style={{ maxWidth: 340, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏸</div>
        <div className="hd-title" style={{ fontSize: 20, marginBottom: 6 }}>
```

### `frontend/src/games/hacker-defense/components/TowerToolbar.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { TowerType } from '../types';
import { TOWER_DEFS } from '../constants';

interface Props {
  dataPoints: number;
  selectedTowerType: TowerType | null;
  onSelect: (type: TowerType | null) => void;
  actionCommandWindow: number;
}

const TOWERS: Array<{ type: TowerType; emojiKey: string; nameKey: string }> = [
  { type: 'password', emojiKey: '🔐', nameKey: 'hackerDefense:towers.password.name' },
  { type: 'antivirus', emojiKey: '🛡️', nameKey: 'hackerDefense:towers.antivirus.name' },
  { type: 'wall_2fa', emojiKey: '📱', nameKey: 'hackerDefense:towers.wall2fa.name' },
```

### `frontend/src/games/hacker-defense/components/TutorialOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';

interface Props {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

const STEPS = [
  { icon: '🏦', key: 'step1' },
  { icon: '🔐', key: 'step2' },
  { icon: '🦠', key: 'step3' },
  { icon: '⌨️', key: 'step4' },
];

```

### `frontend/src/games/hacker-defense/components/TwoFAPrompt.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { TwoFAState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  twoFA: TwoFAState;
  onType: (char: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'];

export default function TwoFAPrompt({ twoFA, onType, onSubmit, onCancel }: Props) {
  const { t } = useTranslation('games');
```

### `frontend/src/games/hacker-defense/components/UpgradeMinigame.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { UpgradeMinigame as UpgradeMinigameType } from '../types';
import { PASSWORD_OPTIONS } from '../constants';

interface Props {
  minigame: UpgradeMinigameType;
  onConfirm: (pw: { upper: string; lower: string; number: string; symbol: string }) => void;
  onCancel: () => void;
}

type Category = 'upper' | 'lower' | 'number' | 'symbol';

export default function UpgradeMinigame({ minigame, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('games');

```

### `frontend/src/games/hacker-defense/constants.ts` (Code)

```typescript
import type { TowerSlot, WaveDef, InboxEmail } from './types';

// ─── Asset Base Path (relative to game-assets bucket) ────────────────────────
const BASE = '13-hacker-defense';

export const AUDIO = {
  bgm: `${BASE}/audio/bgm.mp3`,
  bgmBoss: `${BASE}/audio/bgm-boss.mp3`,
  bgmTense: `${BASE}/audio/bgm-tense.mp3`,
  place: `${BASE}/audio/place-tower.mp3`,
  shoot: `${BASE}/audio/shoot.mp3`,
  kill: `${BASE}/audio/kill.mp3`,
  clack: `${BASE}/audio/clack.mp3`,
  caching: `${BASE}/audio/ca-ching.mp3`,
  alert: `${BASE}/audio/alert.mp3`,
```

### `frontend/src/games/hacker-defense/gameReducer.ts` (Code)

```typescript
import type { GameState, GameAction, Enemy, Tower, Projectile, Particle, DamageNumber, DataPacket, TowerSlot, LevelStats, TwoFAState, BossPopupState } from './types';
import {
  INITIAL_TOWER_SLOTS,
  ENEMY_DEFS,
  TOWER_DEFS,
  LEVEL_WAVES,
  INBOX_EMAILS,
  getPositionOnPath,
  PATH_DATA,
  GAME_CONFIG,
  UPGRADE_COSTS,
} from './constants';

// ─── Helpers ──────────────────────────────────────────────────────────────
let _idCounter = 0;
```

### `frontend/src/games/hacker-defense/hacker-defense.css` (Code)

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Nunito:wght@400;600;700;900&display=swap');

/* ─── Full Screen Game Container ─────────────────────────────────────────── */
.hd-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #0a0e1a;
  overflow: hidden;
  font-family: 'Nunito', sans-serif;
  -webkit-user-select: none;
  user-select: none;
}

/* ─── Scale Wrapper ──────────────────────────────────────────────────────── */
```

### `frontend/src/games/hacker-defense/index.ts` (Code)

```typescript
export { default } from './HackerDefensePage';
```

### `frontend/src/games/hacker-defense/types.ts` (Code)

```typescript
// ─── Game Phases ───────────────────────────────────────────────────────────
export type GamePhase =
  | 'START'
  | 'TUTORIAL'
  | 'INBOX'
  | 'WAVE_INCOMING'
  | 'PLAYING'
  | 'WAVE_CLEAR'
  | 'LEVEL_RESULT'
  | 'UPGRADE_MINIGAME'
  | 'VICTORY'
  | 'GAME_OVER'
  | 'PAUSED';

// ─── Enemy ────────────────────────────────────────────────────────────────
```

### `frontend/src/games/nam-vs-yum/NamVsYumPage.tsx` (Code)

```typescript
import { NamVsYumGame } from './components/NamVsYumGame';
import './nam-vs-yum.css';

export default function NamVsYumPage() {
  return (
    <div className="game-fullscreen pixel-font">
      <NamVsYumGame />
    </div>
  );
}
```

### `frontend/src/games/nam-vs-yum/components/AchievementGallery.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X, Lock } from 'lucide-react';
import type { PlayerProgress, AchievementId } from '../types';
import { ACHIEVEMENTS } from '../constants';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AchievementGalleryProps {
  progress: PlayerProgress;
  onClose: () => void;
}

export function AchievementGallery({ progress, onClose }: AchievementGalleryProps) {
  const { t } = useTranslation('games');
```

### `frontend/src/games/nam-vs-yum/components/AchievementPopup.tsx` (Code)

```typescript
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AchievementId } from '../types';
import { ACHIEVEMENTS } from '../constants';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AchievementPopupProps {
  achievementId: AchievementId;
  onDismiss: () => void;
}

export function AchievementPopup({ achievementId, onDismiss }: AchievementPopupProps) {
  const { t } = useTranslation('games');
```

### `frontend/src/games/nam-vs-yum/components/BombTimer.tsx` (Code)

```typescript
import { cn } from '@/lib/utils';

interface BombTimerProps {
  timer: number;
  x: number;
  y: number;
}

export function BombTimer({ timer, x, y }: BombTimerProps) {
  const isUrgent = timer <= 2;

  return (
    <div
      className={cn(
        'absolute pointer-events-none pixel-font text-xs font-bold',
```

### `frontend/src/games/nam-vs-yum/components/FallingItem.tsx` (Code)

```typescript
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FallingItem as FallingItemType, GameItemDefinition } from '../types';
import { GAME_CONFIG } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import { cn } from '@/lib/utils';

interface FallingItemProps {
  item: FallingItemType;
  definition: GameItemDefinition;
  onDragStart: (id: string, offsetX: number, offsetY: number) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
}

```

### `frontend/src/games/nam-vs-yum/components/FloatingText.tsx` (Code)

```typescript
import { cn } from '@/lib/utils';

interface FloatingTextItem {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface FloatingTextProps {
  texts: FloatingTextItem[];
}

export function FloatingText({ texts }: FloatingTextProps) {
```

### `frontend/src/games/nam-vs-yum/components/FrenzyBar.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { GAME_CONFIG } from '../constants';

interface FrenzyBarProps {
  frenzyCount: number;
  isFrenzyMode: boolean;
}

export function FrenzyBar({ frenzyCount, isFrenzyMode }: FrenzyBarProps) {
  const { t } = useTranslation('games');
  const progress = Math.min(frenzyCount / GAME_CONFIG.frenzyThreshold, 1);

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 60 }}>
```

### `frontend/src/games/nam-vs-yum/components/GameHUD.tsx` (Code)

```typescript
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameHUDProps {
  score: number;
  lives: number;
  maxLives: number;
  combo: number;
  comboMultiplier: number;
  level: number;
  onPause: () => void;
  coins: number;
  playerLevel: number;
```

### `frontend/src/games/nam-vs-yum/components/GameOverScreen.tsx` (Code)

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState, AchievementId } from '../types';
import { MENTOR_CHARACTERS } from '../constants';
import { cn } from '@/lib/utils';
import { Trophy, Award, TrendingUp } from 'lucide-react';

interface GameOverScreenProps {
  state: GameState;
  onRetry: () => void;
  onExit: () => void;
  newAchievements: AchievementId[];
  onShowLeaderboard: () => void;
}

```

### `frontend/src/games/nam-vs-yum/components/GameStartScreen.tsx` (Code)

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import { cn } from '@/lib/utils';
import { Trophy, ShoppingBag, BarChart3, Award } from 'lucide-react';
import type { PlayerProgress } from '../types';

interface GameStartScreenProps {
  highScore: number;
  onPlay: () => void;
  onTutorial: () => void;
  onAchievements: () => void;
  onShop: () => void;
  onStats: () => void;
```

### `frontend/src/games/nam-vs-yum/components/LeaderboardScreen.tsx` (Code)

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X, Trophy, Medal } from 'lucide-react';
import type { LeaderboardEntry } from '../types';

interface LeaderboardScreenProps {
  entries: LeaderboardEntry[];
  currentHighScore: number;
  onClose: () => void;
  onSaveEntry?: (entry: LeaderboardEntry) => void;
}

const STORAGE_KEY = 'namvsyum_leaderboard';

```

### `frontend/src/games/nam-vs-yum/components/LevelCompleteScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Star, Zap, Clock } from 'lucide-react';

interface LevelCompleteScreenProps {
  level: number;
  itemsSorted: number;
  correctItems: number;
  isPerfect: boolean;
  onContinue: () => void;
}

export function LevelCompleteScreen({ level, itemsSorted, correctItems, isPerfect, onContinue }: LevelCompleteScreenProps) {
  const { t } = useTranslation('games');

```

### `frontend/src/games/nam-vs-yum/components/MentorPopup.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { MentorTip } from '../types';
import { cn } from '@/lib/utils';

interface MentorPopupProps {
  tip: MentorTip;
  onDismiss: () => void;
}

const MENTOR_EMOJIS: Record<string, string> = {
  drRho: '👨🏻‍💼',
  zara: '👩🏻‍💼',
  liruf: '🦖',
  dina: '🦕',
};
```

### `frontend/src/games/nam-vs-yum/components/Monster.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import type { MonsterType, SkinId } from '../types';
import { PICTURES, SKIN_CONFIG } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import { cn } from '@/lib/utils';

interface MonsterProps {
  type: MonsterType;
  isEating: boolean;
  isRejecting: boolean;
  isHighlighted: boolean;
  skin?: SkinId;
  hasBombNearby?: boolean;
  isFrenzy?: boolean;
}
```

### `frontend/src/games/nam-vs-yum/components/MonsterShop.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X, Check, Lock } from 'lucide-react';
import type { PlayerProgress, SkinId, ThemeId } from '../types';
import { SKIN_PRICES, THEME_PRICES, SKIN_CONFIG, THEME_GRADIENTS } from '../constants';

interface MonsterShopProps {
  progress: PlayerProgress;
  onClose: () => void;
  onUnlockSkin: (skin: SkinId) => void;
  onUnlockTheme: (theme: ThemeId) => void;
  onEquipSkin: (monster: 'vitalio' | 'capricho', skin: SkinId) => void;
  onEquipTheme: (theme: ThemeId) => void;
  onSpendCoins: (amount: number) => boolean;
}
```

### `frontend/src/games/nam-vs-yum/components/NamVsYumGame.tsx` (Code)

```typescript
import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { AssetImg } from '@/components/ui/AssetImg';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSound } from '@/contexts/SoundContext';
import { cn } from '@/lib/utils';

import { gameReducer, createInitialState } from '../gameReducer';
import { useGameEngine } from '../useGameEngine';
import { ITEMS, AUDIO, PICTURES, GAME_CONFIG, DIFFICULTY_LEVELS, THEME_GRADIENTS, SKIN_CONFIG } from '../constants';
import type { MonsterType } from '../types';
import { usePlayerProgress } from '../hooks/usePlayerProgress';
import { useAchievements } from '../hooks/useAchievements';
import { useKeyboardControls } from '../hooks/useKeyboardControls';

```

### `frontend/src/games/nam-vs-yum/components/ParticleSystem.tsx` (Code)

```typescript
import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

interface ParticleSystemProps {
```

### `frontend/src/games/nam-vs-yum/components/PauseOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PauseOverlayProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onRestart, onQuit }: PauseOverlayProps) {
  const { t } = useTranslation('games');
  const { mute, toggleMute } = useSound();

```

### `frontend/src/games/nam-vs-yum/components/PowerUpIndicator.tsx` (Code)

```typescript
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PowerUpType } from '../types';
import { POWER_UPS } from '../constants';

interface PowerUpIndicatorProps {
  activePowerUp: { type: PowerUpType; endsAt: number } | null;
}

export function PowerUpIndicator({ activePowerUp }: PowerUpIndicatorProps) {
  const { t } = useTranslation('games');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
```

### `frontend/src/games/nam-vs-yum/components/StatsScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X, Trophy, Gamepad2, Target, Clock, Zap, TrendingUp, Award } from 'lucide-react';
import type { PlayerProgress } from '../types';

interface StatsScreenProps {
  progress: PlayerProgress;
  accuracy: number;
  onClose: () => void;
}

export function StatsScreen({ progress, accuracy, onClose }: StatsScreenProps) {
  const { t } = useTranslation('games');

  const formatTime = (ms: number) => {
```

### `frontend/src/games/nam-vs-yum/components/TrashZone.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface TrashZoneProps {
  isHighlighted: boolean;
}

export function TrashZone({ isHighlighted }: TrashZoneProps) {
  const { t } = useTranslation('games');

  return (
    <div
      className={cn(
        'absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-end pb-3 sm:pb-4',
```

### `frontend/src/games/nam-vs-yum/components/TutorialOverlay.tsx` (Code)

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import { cn } from '@/lib/utils';
import { ArrowDown, Heart } from 'lucide-react';

interface TutorialOverlayProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({ onComplete, onSkip }: TutorialOverlayProps) {
  const { t } = useTranslation('games');
  const [step, setStep] = useState(0);
```

### `frontend/src/games/nam-vs-yum/components/WeatherOverlay.tsx` (Code)

```typescript
import { cn } from '@/lib/utils';
import type { WeatherType } from '../types';

interface WeatherOverlayProps {
  weather: WeatherType;
}

export function WeatherOverlay({ weather }: WeatherOverlayProps) {
  if (weather === 'sunny') return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 35 }}>
      {weather === 'rainy' && (
        <>
          {Array.from({ length: 30 }).map((_, i) => (
```

### `frontend/src/games/nam-vs-yum/constants.ts` (Code)

```typescript
import type { GameItemDefinition, DifficultyLevel, MentorCharacter, PowerUpDefinition, AchievementDefinition } from './types';

const BASE = '2-nam-vs-yum-game';

export const AUDIO = {
  bgm: `${BASE}/audio/bgm-retro-loop.mp3`,
  correct: `${BASE}/audio/correct.mp3`,
  incorrect: `${BASE}/audio/incorrect.mp3`,
  combo: `${BASE}/audio/combo.mp3`,
  levelUp: `${BASE}/audio/level-up.mp3`,
  gameOver: `${BASE}/audio/game-over.mp3`,
  chomp: `${BASE}/audio/chomp.mp3`,
  reject: `${BASE}/audio/reject.mp3`,
  mentorPop: `${BASE}/audio/mentor-pop.mp3`,
  highScore: `${BASE}/audio/high-score.mp3`,
```

### `frontend/src/games/nam-vs-yum/gameReducer.ts` (Code)

```typescript
import type { GameState, GameAction, AchievementId } from './types';
import { COMBO_THRESHOLD, MAX_COMBO_MULTIPLIER, GAME_CONFIG } from './constants';

const loadHighScore = (): number => {
  try {
    return parseInt(localStorage.getItem(GAME_CONFIG.highScoreKey) || '0', 10);
  } catch {
    return 0;
  }
};

const saveHighScore = (score: number) => {
  try {
    localStorage.setItem(GAME_CONFIG.highScoreKey, String(score));
  } catch {
```

### `frontend/src/games/nam-vs-yum/hooks/useAchievements.ts` (Code)

```typescript
import { useCallback } from 'react';
import type { AchievementId, GameState } from '../types';
import { ACHIEVEMENTS } from '../constants';

export interface AchievementCheckResult {
  newlyUnlocked: AchievementId[];
  progressUpdates: { id: AchievementId; progress: number }[];
}

export function useAchievements() {
  const checkAchievements = useCallback((
    state: GameState,
    totalItemsSorted: number,
    maxComboEver: number,
    highestLevelReached: number,
```

### `frontend/src/games/nam-vs-yum/hooks/useFullscreen.ts` (Code)

```typescript
import { useState, useEffect, useCallback } from 'react';

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
```

### `frontend/src/games/nam-vs-yum/hooks/useKeyboardControls.ts` (Code)

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface UseKeyboardControlsProps {
  isPlaying: boolean;
  onPause: () => void;
  onKonami?: () => void;
}

export function useKeyboardControls({ isPlaying, onPause, onKonami }: UseKeyboardControlsProps) {
  const konamiRef = useRef<string[]>([]);
  const KONAMI_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Konami code tracking (works always)
```

### `frontend/src/games/nam-vs-yum/hooks/usePlayerProgress.ts` (Code)

```typescript
import { useCallback, useState } from 'react';
import type { PlayerProgress, AchievementId, SkinId, ThemeId } from '../types';

const STORAGE_KEY = 'namvsyum_progress';

const DEFAULT_PROGRESS: PlayerProgress = {
  playerLevel: 1,
  totalXp: 0,
  coins: 0,
  totalGamesPlayed: 0,
  totalItemsSorted: 0,
  maxComboEver: 0,
  highestLevelReached: 1,
  totalTimePlayedMs: 0,
  accuracyNumerator: 0,
```

### `frontend/src/games/nam-vs-yum/index.ts` (Code)

```typescript
export { default as NamVsYumPage } from './NamVsYumPage';
```

### `frontend/src/games/nam-vs-yum/nam-vs-yum.css` (Code)

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

.pixel-font {
  font-family: 'Press Start 2P', monospace;
}

.game-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
  overflow: hidden;
  background: #0a0a1a;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
```

### `frontend/src/games/nam-vs-yum/types.ts` (Code)

```typescript
export type GamePhase = 'START' | 'TUTORIAL' | 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'ACHIEVEMENT_UNLOCKED' | 'GAME_OVER';

export type MonsterType = 'vitalio' | 'capricho';

export type ItemCategory = 'need' | 'want';

export type ItemVariant = 'normal' | 'golden' | 'bomb' | 'mystery' | 'rainbow' | 'unicorn';

export type PowerUpType = 'freezeTime' | 'scoreBoost' | 'extraLife' | 'magnet' | 'clearScreen' | 'slowMotion';

export type WeatherType = 'sunny' | 'rainy' | 'storm' | 'night' | 'goldenHour';

export type AchievementId =
  | 'firstSteps'
  | 'sorterApprentice'
```

### `frontend/src/games/nam-vs-yum/useGameEngine.ts` (Code)

```typescript
import { useEffect, useRef, useCallback } from 'react';
import type { GameState, GameAction, FallingItem, MonsterType, ItemCategory, PowerUpType } from './types';
import {
  ITEMS,
  DIFFICULTY_LEVELS,
  MENTOR_CHARACTERS,
  POWER_UPS,
  GAME_CONFIG,
} from './constants';

let itemIdCounter = 0;

function getDifficulty(level: number) {
  const maxIdx = DIFFICULTY_LEVELS.length - 1;
  if (level <= DIFFICULTY_LEVELS.length) {
```

### `frontend/src/games/nectar-of-shadows/NectarOfShadowsPage.tsx` (Code)

```typescript
import { NectarGame } from './components/NectarGame';
import './nectar-of-shadows.css';

export default function NectarOfShadowsPage() {
  return (
    <div className="game-fullscreen nectar-font">
      <NectarGame />
    </div>
  );
}
```

### `frontend/src/games/nectar-of-shadows/components/DaySummary.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Day Summary – Results screen after market phase
   ────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, MENTOR_TIPS } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import type { DayResult, MentorTip, MentorCharacter } from '../types';

interface Props {
  day: number;
  result: DayResult;
  totalCoins: number;
  onContinue: () => void;
```

### `frontend/src/games/nectar-of-shadows/components/GameOverScreen.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Game Over Screen – Néctar de las Sombras
   ────────────────────────────────────────────────────────────── */

import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  day: number;
  totalCoinsEarned: number;
  highScore: number;
  bestDay: number;
  isNewHighScore: boolean;
  onRetry: () => void;
```

### `frontend/src/games/nectar-of-shadows/components/GameStartScreen.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Start Screen – Néctar de las Sombras
   ────────────────────────────────────────────────────────────── */

import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  highScore: number;
  bestDay: number;
  onPlay: () => void;
  onTutorial: () => void;
}

```

### `frontend/src/games/nectar-of-shadows/components/MarketPhase.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Market Phase – Customers walk past the stand
   ────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, GAME_CONFIG, calculateSatisfaction } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import type { Customer, Recipe, WeatherType, DayResult } from '../types';

interface Props {
  recipe: Recipe;
  weather: WeatherType;
  day: number;
  coins: number;
```

### `frontend/src/games/nectar-of-shadows/components/MentorPopup.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Mentor Popup – Character dialogue box
   ────────────────────────────────────────────────────────────── */

import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import type { MentorTip, MentorCharacter } from '../types';

interface Props {
  tip: MentorTip;
  onDismiss: () => void;
}

const MENTOR_PICS: Record<MentorCharacter, string> = {
```

### `frontend/src/games/nectar-of-shadows/components/NectarGame.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Main Game Component
   ────────────────────────────────────────────────────────────── */

import { useReducer, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';
import { AUDIO } from '../constants';
import { gameReducer, createInitialState } from '../gameReducer';
import type { Recipe, DayResult, UpgradeKey, MentorTip } from '../types';

import { GameStartScreen } from './GameStartScreen';
import { TutorialOverlay } from './TutorialOverlay';
import { RunnerPhase } from './RunnerPhase';
```

### `frontend/src/games/nectar-of-shadows/components/PauseOverlay.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Pause Overlay – Néctar de las Sombras
   ────────────────────────────────────────────────────────────── */

import { useTranslation } from 'react-i18next';

interface Props {
  soundOn: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onToggleSound: () => void;
}

export function PauseOverlay({ soundOn, onResume, onRestart, onQuit, onToggleSound }: Props) {
```

### `frontend/src/games/nectar-of-shadows/components/RunnerPhase.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Runner Phase – 2D side-scrolling collection phase
   ────────────────────────────────────────────────────────────── */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, GAME_CONFIG } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import type { RunnerCollectible, RunnerObstacle } from '../types';

interface Props {
  day: number;
  onFinish: (lemons: number, sugar: number) => void;
  hasSqueezer: boolean;
  playSfx: (name: string) => void;
```

### `frontend/src/games/nectar-of-shadows/components/StandPhase.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Stand Preparation Phase – Visual recipe builder
   ────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, GAME_CONFIG, MENTOR_TIPS, calculateSatisfaction, getIdealRecipe } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import type { WeatherType, Recipe, MentorTip, MentorCharacter } from '../types';

interface Props {
  weather: WeatherType;
  lemonsAvailable: number;
  sugarAvailable: number;
  day: number;
```

### `frontend/src/games/nectar-of-shadows/components/TutorialOverlay.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Tutorial Overlay – Néctar de las Sombras
   ────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  onComplete: () => void;
}

export function TutorialOverlay({ onComplete }: Props) {
  const { t } = useTranslation('games');
```

### `frontend/src/games/nectar-of-shadows/components/UpgradeShop.tsx` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Upgrade Shop – Invest coins into improvements
   ────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import type { Upgrade, UpgradeKey } from '../types';

interface Props {
  coins: number;
  vaultSavings: number;
  upgrades: Upgrade[];
  hasVault: boolean;
```

### `frontend/src/games/nectar-of-shadows/constants.ts` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Constants & Configuration
   ────────────────────────────────────────────────────────────── */

import type { Upgrade, MentorTip } from './types';

const BASE = '1-the-small-entrepreneur';

/* ── Audio assets ─────────────────────────────────────────── */
export const AUDIO = {
  bgm: `${BASE}/audio/bgm-ambient.mp3`,
  coinCollect: `${BASE}/audio/coin-collect.mp3`,
  sell: `${BASE}/audio/sell.mp3`,
  customerHappy: `${BASE}/audio/customer-happy.mp3`,
  customerSad: `${BASE}/audio/customer-sad.mp3`,
```

### `frontend/src/games/nectar-of-shadows/gameReducer.ts` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Game State Reducer
   ────────────────────────────────────────────────────────────── */

import type { GameState, GameAction, WeatherType } from './types';
import { GAME_CONFIG, INITIAL_UPGRADES } from './constants';

/* ── Persistence helpers ──────────────────────────────────── */

const loadNumber = (key: string): number => {
  try {
    return parseInt(localStorage.getItem(key) || '0', 10);
  } catch {
    return 0;
  }
```

### `frontend/src/games/nectar-of-shadows/nectar-of-shadows.css` (Code)

```css
/* ══════════════════════════════════════════════════════════════
   Néctar de las Sombras – Hollow Knight-inspired CSS
   ══════════════════════════════════════════════════════════════ */

/* ── Font & Base ──────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');

.nectar-font {
  font-family: 'Inter', sans-serif;
}

.nectar-font h1,
.nectar-font h2 {
  font-family: 'Cinzel', serif;
}
```

### `frontend/src/games/nectar-of-shadows/types.ts` (Code)

```typescript
/* ──────────────────────────────────────────────────────────────
   Néctar de las Sombras – Type definitions
   ────────────────────────────────────────────────────────────── */

export type GamePhase =
  | 'START'
  | 'TUTORIAL'
  | 'RUNNER'
  | 'STAND_PREP'
  | 'MARKET'
  | 'DAY_SUMMARY'
  | 'UPGRADE_SHOP'
  | 'PAUSED'
  | 'GAME_OVER';

```

### `frontend/src/games/paper-coin/PaperCoinPage.tsx` (Code)

```typescript
import { PaperCoinGame } from './components/PaperCoinGame';
import './paper-coin.css';

export default function PaperCoinPage() {
  return (
    <div className="game-fullscreen">
      <PaperCoinGame />
    </div>
  );
}
```

### `frontend/src/games/paper-coin/components/CustomerScene.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GameState } from '../types';
import { THEME_CONFIG } from '../constants';

interface Props {
  state: GameState;
}

function CoinBadge({ amount }: { amount: number }) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{
        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        boxShadow: '0 2px 6px rgba(245,158,11,0.4)',
```

### `frontend/src/games/paper-coin/components/FeedbackOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GameState } from '../types';

interface Props {
  state: GameState;
}

export function FeedbackOverlay({ state }: Props) {
  const { t } = useTranslation('games');

  const isCorrect = state.phase === 'FEEDBACK_CORRECT';
  const isWrong = state.phase === 'FEEDBACK_WRONG';
  const isTimeout = state.phase === 'FEEDBACK_TIMEOUT';

  if (!isCorrect && !isWrong && !isTimeout) return null;
```

### `frontend/src/games/paper-coin/components/GameHUD.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameHUD({ state, dispatch }: Props) {
  const { t } = useTranslation('games');

  const progressPct = Math.min(
    100,
    (state.customersThisDay / state.customersPerDay) * 100,
  );
```

### `frontend/src/games/paper-coin/components/GameOverScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GameState, GameAction } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameOverScreen({ state, dispatch }: Props) {
  const { t } = useTranslation('games');
  const navigate = useNavigate();

  const isNewHighScore = state.score >= state.highScore && state.score > 0;

```

### `frontend/src/games/paper-coin/components/GameStartScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameStartScreen({ state, dispatch }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden">
      {/* Animated background */}
```

### `frontend/src/games/paper-coin/components/NumericKeypad.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onKeyPress?: (key: string) => void;
}

const ROW_1 = ['7', '8', '9'];
const ROW_2 = ['4', '5', '6'];
const ROW_3 = ['1', '2', '3'];

export function NumericKeypad({ state, dispatch, onKeyPress }: Props) {
  const { t } = useTranslation('games');
```

### `frontend/src/games/paper-coin/components/PaperCoinGame.tsx` (Code)

```typescript
import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useSound } from '@/contexts/SoundContext';

import { gameReducer, createInitialState } from '../gameReducer';
import { AUDIO, THEME_CONFIG } from '../constants';
import { GamePhase } from '../types';

import { GameStartScreen } from './GameStartScreen';
import { TutorialOverlay } from './TutorialOverlay';
import { GameHUD } from './GameHUD';
import { CustomerScene } from './CustomerScene';
import { TimerFuse } from './TimerFuse';
import { NumericKeypad } from './NumericKeypad';
import { FeedbackOverlay } from './FeedbackOverlay';
import { ShopScreen } from './ShopScreen';
```

### `frontend/src/games/paper-coin/components/PauseOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';
import { useSound } from '@/contexts/SoundContext';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function PauseOverlay({ state, dispatch }: Props) {
  const { t } = useTranslation('games');
  const { mute, toggleMute } = useSound();

  if (state.phase !== 'PAUSED') return null;

```

### `frontend/src/games/paper-coin/components/ShopScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';
import { SHOP_UPGRADES } from '../constants';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function ShopScreen({ state, dispatch }: Props) {
  const { t } = useTranslation('games');

  const getUpgradeLevel = (id: string): number => {
    if (id === 'hourglass') return state.upgrades.hourglass;
    if (id === 'amulet') return state.upgrades.amulet;
```

### `frontend/src/games/paper-coin/components/TimerFuse.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';

interface Props {
  timeLeft: number;
  maxTime: number;
}

export function TimerFuse({ timeLeft, maxTime }: Props) {
  const { t } = useTranslation('games');
  const pct = maxTime > 0 ? (timeLeft / maxTime) * 100 : 0;
  const isWarning = pct <= 30;
  const isCritical = pct <= 15;

  const fillColor = isCritical
    ? '#ef4444'
```

### `frontend/src/games/paper-coin/components/TutorialOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const STEPS = [
  {
    icon: '👤',
    titleKey: 'paperCoin.tutorial.step1Title',
    descKey: 'paperCoin.tutorial.step1Desc',
    visual: (
      <div className="flex items-end justify-center gap-3 mt-2">
```

### `frontend/src/games/paper-coin/constants.ts` (Code)

```typescript
import { CustomerDef, ItemDef, Transaction, GameUpgrades, ThemeType } from './types';

const BASE = '7-paper-coin';

// ─── Audio ────────────────────────────────────────────────────────────────────
export const AUDIO = {
  bgm: `${BASE}/audio/bgm.mp3`,
  bgmFast: `${BASE}/audio/bgm-fast.mp3`,
  caching: `${BASE}/audio/ca-ching.mp3`,
  error: `${BASE}/audio/error.mp3`,
  paperCrumple: `${BASE}/audio/paper-crumple.mp3`,
  levelUp: `${BASE}/audio/level-up.mp3`,
  gameOver: `${BASE}/audio/game-over.mp3`,
  tick: `${BASE}/audio/tick.mp3`,
  speedBonus: `${BASE}/audio/speed-bonus.mp3`,
```

### `frontend/src/games/paper-coin/gameReducer.ts` (Code)

```typescript
import { GameState, GameAction, GamePhase } from './types';
import {
  GAME_CONFIG,
  generateTransaction,
  getMaxTimeTicks,
  SHOP_UPGRADES,
} from './constants';

export function createInitialState(): GameState {
  const highScore = parseInt(
    localStorage.getItem(GAME_CONFIG.highScoreKey) || '0',
    10,
  );
  return {
    phase: 'START',
```

### `frontend/src/games/paper-coin/index.ts` (Code)

```typescript
export { default } from './PaperCoinPage';
```

### `frontend/src/games/paper-coin/paper-coin.css` (Code)

```css
/* ════════════════════════════════════════════════════════════════
   Paper Coin — Global Styles
   Font: Nunito (rounded, friendly, papery feel)
   ════════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900;1000&family=Fredoka+One&display=swap');

/* ─── Full-screen game wrapper ───────────────────────────────── */
.game-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
  overflow: hidden;
  background: #1a0a00;
}
```

### `frontend/src/games/paper-coin/types.ts` (Code)

```typescript
export type GamePhase =
  | 'START'
  | 'TUTORIAL'
  | 'CUSTOMER_ARRIVING'
  | 'PRESENTING'
  | 'WAITING_INPUT'
  | 'FEEDBACK_CORRECT'
  | 'FEEDBACK_WRONG'
  | 'FEEDBACK_TIMEOUT'
  | 'CUSTOMER_LEAVING'
  | 'SHOP'
  | 'PAUSED'
  | 'GAME_OVER';

export type ThemeType = 'default' | 'forest' | 'castle' | 'ghost';
```

### `frontend/src/games/paper-detective/PaperDetectivePage.tsx` (Code)

```typescript
import { PaperDetectiveGame } from './components/PaperDetectiveGame';
import './paper-detective.css';

export default function PaperDetectivePage() {
  return (
    <div className="game-fullscreen pd-font">
      <PaperDetectiveGame />
    </div>
  );
}
```

### `frontend/src/games/paper-detective/components/GameHUD.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { GAME_CONFIG } from '../constants';

interface Props {
  score: number;
  comboCount: number;
  comboMultiplier: number;
  dayNumber: number;
  timeLeft: number;
  maxTime: number;
  onPause: () => void;
}

export function GameHUD({ score, comboCount, comboMultiplier, dayNumber, timeLeft, maxTime, onPause }: Props) {
  const { t } = useTranslation('games');
```

### `frontend/src/games/paper-detective/components/GameOverScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import type { GameState } from '../types';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  state: GameState;
  onRetry: () => void;
  onExit: () => void;
  onWardrobe: () => void;
}

export function GameOverScreen({ state, onRetry, onExit, onWardrobe }: Props) {
  const { t } = useTranslation('games');

```

### `frontend/src/games/paper-detective/components/GameStartScreen.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { PICTURES, COSMETICS } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  highScore: number;
  totalPoints: number;
  equippedCosmetic: string | null;
  onPlay: () => void;
  onTutorial: () => void;
}

export function GameStartScreen({ highScore, totalPoints, equippedCosmetic, onPlay, onTutorial }: Props) {
  const { t } = useTranslation('games');

```

### `frontend/src/games/paper-detective/components/PaperDetectiveGame.tsx` (Code)

```typescript
import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSound } from '@/contexts/SoundContext';
import { AssetImg } from '@/components/ui/AssetImg';

import { gameReducer, createInitialState } from '../gameReducer';
import { AUDIO, PICTURES, GAME_CONFIG } from '../constants';

import { GameStartScreen } from './GameStartScreen';
import { TutorialOverlay } from './TutorialOverlay';
import { GameHUD } from './GameHUD';
import { Phase1Inspection } from './Phase1Inspection';
import { Phase2Vault } from './Phase2Vault';
import { PauseOverlay } from './PauseOverlay';
```

### `frontend/src/games/paper-detective/components/PauseOverlay.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onRestart, onQuit }: Props) {
  const { t } = useTranslation('games');
  const { mute, toggleMute } = useSound();

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pd-font"
```

### `frontend/src/games/paper-detective/components/Phase1Inspection.tsx` (Code)

```typescript
import { useTranslation } from 'react-i18next';
import { PICTURES, COIN_EMOJI, ITEM_EMOJI } from '../constants';
import type { ItemSilhouette, CoinOption } from '../types';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  item: ItemSilhouette;
  options: CoinOption[];
  selectedId: string | null;
  feedback: 'correct' | 'incorrect' | null;
  onSelect: (coinId: string) => void;
}

function CoinImage({ imageKey, size }: { imageKey: string; size: number }) {
  const src = (PICTURES as Record<string, string>)[imageKey];
```

### `frontend/src/games/paper-detective/components/Phase2Vault.tsx` (Code)

```typescript
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, COIN_EMOJI } from '../constants';
import type { DrawerCoin } from '../types';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  target: number;
  drawerCoins: DrawerCoin[];
  vaultCoins: DrawerCoin[];
  ejectedId: string | null;
  feedback: 'correct' | 'incorrect' | null;
  onAddCoin: (instanceId: string) => void;
  onRemoveCoin: (instanceId: string) => void;
  onClearVault: () => void;
```

### `frontend/src/games/paper-detective/components/TutorialOverlay.tsx` (Code)

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, ITEM_EMOJI, COIN_EMOJI } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  { key: 'step1', emoji: '🔍', imgKey: 'detective' as const },
  { key: 'step2', emoji: '🪙', imgKey: null },
  { key: 'step3', emoji: '🐷', imgKey: 'piggyBank' as const },
  { key: 'step4', emoji: '⏱️', imgKey: null },
```

### `frontend/src/games/paper-detective/components/WardrobeScreen.tsx` (Code)

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COSMETICS, PICTURES } from '../constants';
import type { GameState, GameAction, CosmeticType } from '../types';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onBack: () => void;
  onPlayAgain: () => void;
}

const CATEGORY_ICONS: Record<CosmeticType, string> = {
  hat: '🎩',
```

### `frontend/src/games/paper-detective/constants.ts` (Code)

```typescript
import type { ItemSilhouette, CoinOption, DrawerCoin, Cosmetic } from './types';

// ─────────────────────────────────────────────────────
// Detective de Papel: Misión Alcancía — Constants
// ─────────────────────────────────────────────────────

const BASE = '3-paper-detective';

// ── Audio ────────────────────────────────────────────
export const AUDIO = {
  bgm:       `${BASE}/audio/bgm-jazz.mp3`,
  correct:   `${BASE}/audio/correct.mp3`,
  incorrect: `${BASE}/audio/incorrect.mp3`,
  drag:      `${BASE}/audio/drag.mp3`,
  coinIn:    `${BASE}/audio/coin-in.mp3`,
```

### `frontend/src/games/paper-detective/gameReducer.ts` (Code)

```typescript
import type { GameState, GameAction, CoinOption, MiniGameType } from './types';
import {
  ITEMS, REAL_COINS, FAKE_ITEMS, buildDrawerCoins,
  getDayConfig, GAME_CONFIG, shuffle, randomFrom,
} from './constants';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function getComboMultiplier(comboCount: number): number {
  return Math.min(GAME_CONFIG.maxComboMultiplier, Math.floor(comboCount / GAME_CONFIG.comboThreshold) + 1);
}

function buildPhase1(dayNumber: number, state: GameState): Partial<GameState> {
```

### `frontend/src/games/paper-detective/paper-detective.css` (Code)

```css
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Patrick+Hand&display=swap');

/* ─────────────────────────────────────────────
   Detective de Papel — Base Styles
   ───────────────────────────────────────────── */

.pd-font {
  font-family: 'Nunito', 'Comic Sans MS', cursive, sans-serif;
}

.pd-handwriting {
  font-family: 'Patrick Hand', 'Comic Sans MS', cursive;
}

.game-fullscreen {
```

### `frontend/src/games/paper-detective/types.ts` (Code)

```typescript
// ─────────────────────────────────────────────
// Detective de Papel: Misión Alcancía — Types
// ─────────────────────────────────────────────

export type GamePhase = 'START' | 'TUTORIAL' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'WARDROBE';

export type MiniGameType = 'INSPECTION' | 'VAULT';

// ── Phase 1: Inspection ──────────────────────

/** A real coin denomination or a fake distractor shown as an option */
export interface CoinOption {
  id: string;
  value: number;   // 0 for fakes
  imageKey: string;
```

### `frontend/src/hooks/use-mobile.tsx` (Code)

```typescript
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
```

### `frontend/src/hooks/use-toast.ts` (Code)

```typescript
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
```

### `frontend/src/hooks/useAdminAlerts.ts` (Code)

```typescript
/**
 * useAdminAlerts Hook
 *
 * Frontend-only admin "inbox". Aggregates read-only data the panel already
 * exposes into a single list of actionable alerts for the notification bell:
 *   - Pending platform reports   → GET /reports/?status=pending
 *   - Recent edits by OTHER admins → recent_edits from /admin/stats
 *   - Active broadcast notifications → notificationsAdminApi.list({status:'active'})
 *
 * "Read" state is tracked in localStorage (`admin_alerts_seen`); no backend.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
```

### `frontend/src/hooks/useAdminAudio.ts` (Code)

```typescript
/**
 * useAdminAudio Hook
 *
 * TanStack Query hooks for admin audio management.
 * Includes queries and mutations for audio file uploads, generation, and deletion.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types
export interface AudioFilters {
  character_id?: string;
  lesson_id?: string;
  page?: number;
```

### `frontend/src/hooks/useAdminCharacters.ts` (Code)

```typescript
/**
 * useAdminCharacters Hook
 *
 * TanStack Query hooks for admin character management.
 * Includes queries and mutations for character CRUD operations and gesture management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types
export interface Gesture {
  id: string;
  gesture_code: string;
  animation_data: any;  // JSON field - can be object or null
```

### `frontend/src/hooks/useAdminHistory.ts` (Code)

```typescript
/**
 * useAdminHistory Hook
 *
 * TanStack Query hooks for admin history tracking.
 * Includes queries and mutations for viewing and rolling back entity changes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types
export interface HistoryFilters {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
```

### `frontend/src/hooks/useAdminLessons.ts` (Code)

```typescript
/**
 * useAdminLessons Hook
 *
 * TanStack Query hooks for admin lesson management.
 * Includes queries and mutations for CRUD operations and lesson utilities.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types
export interface LessonFilters {
  adventure_level?: number;
  saga_level?: number;
  topic_level?: number;
```

### `frontend/src/hooks/useAdminSettings.ts` (Code)

```typescript
/**
 * useAdminSettings Hook
 *
 * Frontend-only admin preferences persisted in localStorage under
 * `admin_settings`. No backend involved. Changes are broadcast to every
 * mounted instance via a custom window event so the header, sidebar and
 * settings page stay in sync without a global store.
 */

import { useCallback, useEffect, useState } from 'react';

export interface AdminSettings {
  /** Minimize animations and transitions across the admin panel. */
  reduceMotion: boolean;
  /** Show the unread-count badge on the notification bell. */
```

### `frontend/src/hooks/useAdminStats.ts` (Code)

```typescript
/**
 * useAdminStats Hook
 *
 * TanStack Query hooks for admin statistics and user management.
 * Includes queries for stats and user data, and mutations for user role changes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types - RecentEdit from stats endpoint
export interface RecentEdit {
  id: string;
  editor_user_id: string;
  editor_name: string;
```

### `frontend/src/hooks/useAsset.ts` (Code)

```typescript
import { useState, useEffect } from 'react';
import { getImageBlobUrl } from '@/lib/assets';

/**
 * Resolves a Supabase bucket path to a session-scoped blob:// URL.
 * Returns null while loading or on error (use as fallback signal).
 */
export function useAsset(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    getImageBlobUrl(path)
```

### `frontend/src/hooks/useAuth.ts` (Code)

```typescript
import { useCallback } from 'react';
import { getGuestProfile, clearGuestProfile, isGuest as checkIsGuest, type GuestProfile } from '@/lib/guestProfile';
import { supabase } from '@/lib/supabase';

interface AuthUser {
    email: string;
    user_type: string;
    public_id?: string;
    name?: string;
    username?: string;
    [key: string]: unknown;
}

function getAuthUser(): AuthUser | null {
    try {
```

### `frontend/src/hooks/useLanguage.ts` (Code)

```typescript
/**
 * useLanguage Hook
 * 
 * Custom hook for language management in LittleFounders.
 * Provides easy access to language switching and current language state.
 * 
 * Usage:
 * ```tsx
 * const { currentLanguage, changeLanguage, languages, isCurrentLanguage } = useLanguage();
 * ```
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
```

### `frontend/src/hooks/useScrollReveal.ts` (Code)

```typescript
import { useEffect, useRef } from "react";

/**
 * useScrollReveal
 * Adds the `is-visible` class to the observed element once it enters the
 * viewport, driving the `.reveal` CSS transitions. One-shot by default so
 * content stays put after the first reveal (feels calmer on a corporate site).
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; rootMargin?: string; once?: boolean } = {}
) {
  const { threshold = 0.15, rootMargin = "0px 0px -10% 0px", once = true } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
```

### `frontend/src/hooks/useUserLanguage.ts` (Code)

```typescript
/**
 * useUserLanguage Hook
 * 
 * Syncs language preference with the backend for authenticated users.
 * Automatically loads user's saved language preference on login,
 * and saves changes to the backend when language is changed.
 * 
 * Usage:
 * ```tsx
 * const { syncLanguagePreference, saveLanguagePreference } = useUserLanguage();
 * 
 * // On login, sync with backend
 * useEffect(() => { syncLanguagePreference(); }, [isLoggedIn]);
 * 
 * // When user changes language
```

### `frontend/src/i18n/index.ts` (Code)

```typescript
/**
 * i18n Configuration for LittleFounders
 * 
 * This file sets up react-i18next for internationalization.
 * Currently supports: Spanish (es) and English (en)
 * Default language: Spanish
 * 
 * Usage in components:
 * ```tsx
 * import { useTranslation } from 'react-i18next';
 * 
 * function MyComponent() {
 *   const { t } = useTranslation('common');
 *   return <button>{t('buttons.continue')}</button>;
 * }
```

### `frontend/src/index.css` (Code)

```css
/* ── Animatable Glass Properties ── */
@property --glass-badge-glow {
  syntax: '<number>';
  initial-value: 0;
  inherits: false;
}

@property --glass-card-lift {
  syntax: '<length>';
  initial-value: 0px;
  inherits: false;
}

@property --glass-border-alpha {
  syntax: '<number>';
```

### `frontend/src/lib/analytics.ts` (Code)

```typescript
type GtagEventParams = Record<string, string | number | boolean | string[] | number[] | null | undefined>;

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetIdOrEventName: string | Date,
      params?: Record<string, unknown>,
    ) => void;
  }
}

function isTrackingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
```

### `frontend/src/lib/api/notifications.ts` (Code)

```typescript
import { API_URL } from "../../config/api";

const getToken = () => {
  const rawToken = localStorage.getItem('token');
  return rawToken ? rawToken.replace(/"/g, '') : '';
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// ── Types ──

export interface NotificationItem {
```

### `frontend/src/lib/api/social.ts` (Code)

```typescript
import { API_URL } from "../../config/api";

const getToken = () => {
  const rawToken = localStorage.getItem('token');
  return rawToken ? rawToken.replace(/"/g, '') : '';
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

export interface UserPublicProfile {
  public_id: string;
  username: string;
```

### `frontend/src/lib/assets.ts` (Code)

```typescript
import { supabase } from './supabase';
import { API_URL } from '@/config/api';

const BUCKET = 'game-assets';
const TTL_SECONDS = 3600; // 1 hour

// ─── Signed URL cache (path → { url, expiresAt, isPublic }) ─────────────────
const signedUrlCache = new Map<string, { url: string; expiresAt: number; isPublic?: boolean }>();

/** Get a signed URL for a game asset.
 *  For authenticated users: uses Supabase JS client directly.
 *  For guests (no token): falls back to the backend proxy endpoint which uses service_role.
 *  Last resort: public bucket URL (game-assets is public).
 */
export async function getSignedUrl(path: string): Promise<string> {
```

### `frontend/src/lib/guestProfile.ts` (Code)

```typescript
export interface PlacementResult {
    version: 1;
    takenAt: string;
    durationSec: number;
    ageDeclared: number;
    baseAdventure: number;
    finalAdventure: number;
    finalSaga: number;
    /** First lesson of the assigned saga — e.g. "3-2-1-1" */
    targetLessonCode: string;
    overallScore: number;
    confidence: number;
    skipped: boolean;
    itemsServed: string[];
    itemsCorrect: string[];
```

### `frontend/src/lib/streakUtils.ts` (Code)

```typescript
/**
 * streakUtils.ts
 *
 * The 3 visual states of a daily streak:
 *
 *  'zero'     — Streak = 0.  Either never started or missed 2+ days.
 *               Flame: gray   Number: 0
 *
 *  'inactive' — Had activity YESTERDAY, but none today yet. Streak is
 *               "sleeping" — the user still has until 11:59 PM to save it.
 *               Flame: gray   Number: current streak value (e.g. 365)
 *
 *  'active'   — Already completed an activity TODAY. Streak is "on fire".
 *               The celebration animation fires only once per day (on
 *               the first completion that transitions inactive → active).
```

### `frontend/src/lib/supabase.ts` (Code)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### `frontend/src/lib/utils.ts` (Code)

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### `frontend/src/lottie.d.ts` (Code)

```typescript
declare namespace JSX {
    interface IntrinsicElements {
        'dotlottie-wc': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            src?: string;
            autoplay?: boolean;
            loop?: boolean;
            mode?: string;
        };
    }
}
```

### `frontend/src/main.tsx` (Code)

```typescript
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize i18n (must be imported before App renders)
import './i18n'

// Protect images globally from being right-clicked or dragged
document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) {
    event.preventDefault();
  }
});

document.addEventListener('dragstart', (event) => {
```

### `frontend/src/pages/AuthCallback.tsx` (Code)

```typescript
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/config/api';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getTranslatedError } from '@/utils/errorUtils';
import { useSound } from '@/contexts/SoundContext';
import { savePendingMerge, clearPendingMerge } from '@/lib/guestProfile';

const AuthCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const { t } = useTranslation(['auth', 'errors']);
```

### `frontend/src/pages/AvatarEditor.tsx` (Code)

```typescript
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shuffle, Save, Check, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

// Avatar option categories with their correct DiceBear values
const AVATAR_OPTIONS = {
    top: {
        label: 'Cabello',
```

### `frontend/src/pages/Bye.tsx` (Code)

```typescript
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const Bye = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('common');

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/');
        }, 5000);

```

### `frontend/src/pages/ForgotPassword.tsx` (Code)

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

const ForgotPassword = () => {
  const { t } = useTranslation(['auth']);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
```

### `frontend/src/pages/GamesPage.tsx` (Code)

```typescript
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Play, BookOpen, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { AssetImg } from "@/components/ui/AssetImg";

interface GameCard {
  id: string;
  path: string;
  titleKey: string;
  subtitleKey: string;
  gif: string;
  fallbackEmojis: string[];
```

### `frontend/src/pages/Help.tsx` (Code)

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReportFAB } from "@/components/common/ReportFAB";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  ChevronDown,
  BookOpen,
  Gamepad2,
  Shield,
  MessageSquare,
} from "lucide-react";

// ── FAQ Item Component ─────────────────────────────────────────────────────────

```

### `frontend/src/pages/Index.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { isGuest, getPendingMerge, clearPendingMerge } from "@/lib/guestProfile";
import { API_URL } from "@/config/api";

const Index = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

```

### `frontend/src/pages/LandingPage.tsx` (Code)

```typescript
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { hasSession } from "@/lib/guestProfile";
import { Reveal } from "@/components/landing/Reveal";
import { LiquidGlassMedia } from "@/components/landing/LiquidGlassMedia";
import { LandingLayout } from "@/components/landing/LandingLayout";
import {
  ArrowRight,
  ShieldCheck,
  Globe,
  Sparkles,
  BookOpen,
  Gamepad2,
  Bot,
  LayoutDashboard,
```

### `frontend/src/pages/LearnPage.tsx` (Code)

```typescript
/**
 * LearnPage — /learn
 * Zero-click unified learning experience.
 * • Wallpapers reused as adventure section dividers
 * • LessonPath (Duolingo caminito) embedded per saga — no extra navigation clicks
 * • Auto-scrolls to the user's current lesson on first load
 * • Full i18n, mobile-first, light/dark compatible, Liquid Glass aesthetic
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdventureCard } from '@/components/lessons/AdventureCard';
import { LessonPath } from '@/components/lessons/LessonPath';
import { useAdventuresAPI, type Adventure } from '@/components/lessons/hooks/useAdventures';
import { useLessonsList } from '@/components/lessons/hooks/useLessonsList';
import { useResumeLesson } from '@/components/lessons/hooks/useResumeLesson';
import { useSagaData, type SagaData } from '@/components/lessons/hooks/useSagaData';
```

### `frontend/src/pages/Login.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { SiDiscord } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/api";
import { useSound } from "@/contexts/SoundContext";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

const Login = () => {
  const { t } = useTranslation(['auth', 'common', 'errors']);
```

### `frontend/src/pages/NotFound.tsx` (Code)

```typescript
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation('common');

  useEffect(() => {
    console.error(
      t('common:notFound.console_error'),
      location.pathname
    );
  }, [location.pathname, t]);

```

### `frontend/src/pages/Onboarding.tsx` (Code)

```typescript
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ChevronRight, Check, Sparkles } from "lucide-react";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { DinaCharacter } from "@/components/characters/DinaCharacter";
import DrRhoCharacter from "@/components/characters/DrRhoCharacter";
import ZaraVexCharacter from "@/components/characters/ZaraVexCharacter";
import { setGuestProfile, getGuestProfile } from "@/lib/guestProfile";
import { trackEvent } from "@/lib/analytics";
import { useSound } from "@/contexts/SoundContext";

const STEP_NAMES: Record<number, string> = {
  0: "welcome",
```

### `frontend/src/pages/PageUnderConstruction.tsx` (Code)

```typescript
import React from "react";
import { Hammer, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function PageUnderConstruction() {
    const navigate = useNavigate();
    const { t } = useTranslation('common');

    return (
        <div className="corp flex flex-col items-center justify-center min-h-[80vh] text-center p-4 animate-in fade-in duration-500">
            <div className="corp-icon-chip rounded-full w-40 h-40 mb-6">
                <Construction className="w-24 h-24" />
            </div>
```

### `frontend/src/pages/PlacementPage.tsx` (Code)

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getGuestProfile } from '@/lib/guestProfile';
import { PlacementEngine } from '@/features/placement/PlacementEngine';

export default function PlacementPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState(18);

  useEffect(() => {
    const userRaw = localStorage.getItem('user');
    const guest = getGuestProfile();
```

### `frontend/src/pages/Profile.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Mail, Shield, Palette, Loader2, Globe, AtSign, UserCircle, ArrowLeft, Users, UserPlus, Search, X } from "lucide-react";
import { socialApi, UserPublicProfile, FollowRequest } from "../lib/api/social";
import { UserConnectionsList } from "@/components/social/UserConnectionsList";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
```

### `frontend/src/pages/ResetPassword.tsx` (Code)

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

const ResetPassword = () => {
  const { t } = useTranslation(['auth']);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
```

### `frontend/src/pages/Settings.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    User as UserIcon,
    AtSign,
    Mail,
    Lock,
```

### `frontend/src/pages/Signup.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { SiDiscord } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Send, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/api";
import { savePendingMerge, clearPendingMerge } from "@/lib/guestProfile";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useSound } from "@/contexts/SoundContext";

```

### `frontend/src/pages/admin/AdminAnalytics.tsx` (Code)

```typescript
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, RefreshCw, ExternalLink, Maximize2, Minimize2,
  AlertTriangle, Loader2, ArrowLeft, MonitorPlay,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Single source of truth for the external analytics dashboard URL. */
export const ADMIN_ANALYTICS_URL = 'https://lf-analytics-production-669d.up.railway.app/';

/**
 * The dashboard is Metabase, which serves `X-Frame-Options: DENY` +
 * `frame-ancestors 'none'`, so embedding is blocked by the browser. The page is
 * therefore "launcher-first": it opens Analytics in a new tab by default, and
```

### `frontend/src/pages/admin/AdminAudio.tsx` (Code)

```typescript
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminAudio, useUploadAudio, useGenerateAudio, useDeleteAudio } from '@/hooks/useAdminAudio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
```

### `frontend/src/pages/admin/AdminCharacters.tsx` (Code)

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminCharacters } from '@/hooks/useAdminCharacters';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Play, Sparkles } from 'lucide-react';
import { normalizeGesture } from '@/utils/gestureMapper';

// Character Components
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter from '@/components/characters/ZaraVexCharacter';

export const AdminCharacters: React.FC = () => {
```

### `frontend/src/pages/admin/AdminDashboard.tsx` (Code)

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Zap, Users, Volume2, TrendingUp, RefreshCw, Shield, Plus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AdminContributionGraph } from '@/components/admin/AdminContributionGraph';
import { AdminActivityChart } from '@/components/admin/AdminActivityChart';

interface RecentEdit {
  id: string;
  editor_user_id: string;
  editor_name: string;
```

### `frontend/src/pages/admin/AdminHelp.tsx` (Code)

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  BookOpen,
  HelpCircle,
  GraduationCap,
```

### `frontend/src/pages/admin/AdminHistory.tsx` (Code)

```typescript
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminHistory, useRollback } from '@/hooks/useAdminHistory';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
```

### `frontend/src/pages/admin/AdminLessonEditor.tsx` (Code)

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useAdminLesson,
  useCreateLesson,
  useUpdateLesson,
  useValidateLesson,
  Lesson,
} from '@/hooks/useAdminLessons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
```

### `frontend/src/pages/admin/AdminLessons.tsx` (Code)

```typescript
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminLessons, useDeleteLesson, useDuplicateLesson } from '@/hooks/useAdminLessons';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
```

### `frontend/src/pages/admin/AdminNotifications.tsx` (Code)

```typescript
import { useState, useEffect, useCallback } from "react";
import {
  Bell, Plus, Filter, RefreshCw, Search, Send, Archive, Edit2,
  Users, User, Globe, Clock, X,
  Megaphone, UserPlus, Flame, Trophy, BookOpen, Sparkles,
} from "lucide-react";
import {
  notificationsAdminApi,
  type NotificationAdminItem,
  type NotificationCreateData,
  type UserSearchResult,
} from "@/lib/api/notifications";

// ── Constants ──

```

### `frontend/src/pages/admin/AdminReports.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { Flag, AlertCircle, Clock, CheckCircle2, XCircle, Filter, RefreshCw, ExternalLink, Video, FileText, Eye, Play, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlatformReport {
  public_id: string;
  reporter_email: string;
  reporter_public_id?: string;
  report_type: 'bug' | 'abuse' | 'suggestion' | 'content' | 'other';
  subject: string;
  reported_url?: string;
```

### `frontend/src/pages/admin/AdminSettings.tsx` (Code)

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, User, Palette, LayoutGrid, Bell, LogOut, Trash2, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useToast } from '@/hooks/use-toast';
import { useAdminSettings } from '@/hooks/useAdminSettings';

const SIDEBAR_KEY = 'admin_sidebar_collapsed';

interface AdminUser {
  name?: string;
  email?: string;
```

### `frontend/src/pages/admin/AdminUsers.tsx` (Code)

```typescript
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminUsers, usePromoteUser, useDemoteUser } from '@/hooks/useAdminStats';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
```

### `frontend/src/pages/dev/LessonLab.tsx` (Code)

```typescript
/**
 * LessonLab — DEV-ONLY reference harness for the Playful DS v2 ("Founder's Quest").
 *
 * Renders the redesigned lesson experience (shell + exercises + reward) with
 * MOCK data so the new UX/UI bar can be reviewed without the backend. This is
 * the approval reference; once the direction is signed off, these patterns get
 * ported into the real LessonRunner + the 43 activity components.
 *
 * Route: /dev/lesson-lab (gated to import.meta.env.DEV in App.tsx).
 */
import { useState } from "react";
import { Check, X, ArrowRight, Trophy, RotateCcw, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { QuestProgress } from "@/components/lessons/engine/ui/QuestProgress";
```

### `frontend/src/pages/landing/FamiliesPage.tsx` (Code)

```typescript
import { useTranslation } from "react-i18next";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { LiquidGlassMedia } from "@/components/landing/LiquidGlassMedia";
import { EmailWaitlistForm } from "@/components/landing/EmailWaitlistForm";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Coins,
  Gift,
  LayoutDashboard,
  ShoppingBag,
  Users,
  ShieldCheck,
```

### `frontend/src/pages/landing/FaqPage.tsx` (Code)

```typescript
import React from "react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { ShowreelPlayer } from "@/components/showreel/ShowreelPlayer";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Bot, Globe, ShieldCheck, Mail, Sparkles, ArrowRight } from "lucide-react";

const FAQ_ITEMS = [
```

### `frontend/src/pages/landing/HowItWorksPage.tsx` (Code)

```typescript
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import {
  ArrowRight,
  UserPlus,
  Gamepad2,
  Bot,
  LineChart,
  Sparkles,
  CheckCircle2,
  Smile,
  ShieldCheck,
} from "lucide-react";
```

### `frontend/src/pages/landing/PricingPage.tsx` (Code)

```typescript
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Zap, Lock, Sparkles, Users, Building2 } from "lucide-react";

/* ── Active tier card ──────────────────────────────────────────────────────── */
function ActiveCard({ t }: { t: (key: string) => string }) {
  const features = [
    t("pricing.freemium_feature_1"),
    t("pricing.freemium_feature_2"),
    t("pricing.freemium_feature_3"),
    t("pricing.freemium_feature_4"),
    t("pricing.freemium_feature_5"),
  ];
```

### `frontend/src/pages/social/UserProfile.tsx` (Code)

```typescript
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Trophy, Star, Flame, Loader2, ArrowLeft } from "lucide-react";
import { socialApi, UserPublicProfile } from "../../lib/api/social";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
```

### `frontend/src/utils/accountSync.ts` (Code)

```typescript
// Sistema de sincronización de cuentas entre padre e hijos
// Este archivo maneja la sincronización de transferencias, aprobaciones de tareas y mesadas

export interface ChildAccount {
  id: string;
  name: string;
  email: string;
  balance: number;
  spendBalance: number;
  saveBalance: number;
  emergencyBalance: number;
  isActive: boolean;
  lastActivity: string;
  monthlyAllowance: number;
  allowanceFrequency: 'weekly' | 'biweekly' | 'monthly';
```

### `frontend/src/utils/errorUtils.ts` (Code)

```typescript
import { TFunction } from "i18next";

/**
 * Maps backend error messages to localized strings.
 * 
 * @param error The error object or string from the backend response (usually data.detail).
 * @param t The translation function from useTranslation.
 * @returns A localized error message string.
 */
export const getTranslatedError = (error: any, t: TFunction): string => {
    // If error is undefined or null, return generic error
    if (!error) {
        return t('errors:generic.something_went_wrong');
    }

```

### `frontend/src/utils/gestureMapper.ts` (Code)

```typescript
/**
 * Gesture Mapper Utility
 * 
 * Provides gesture equivalence mappings and default fallbacks for character gestures.
 * This ensures backward compatibility when lesson data uses old/different gesture codes.
 */

interface GestureMapping {
    default: string;
    mappings: Record<string, string>;
}

interface GestureEquivalences {
    [characterCode: string]: GestureMapping;
}
```

### `frontend/src/vite-env.d.ts` (Code)

```typescript
/// <reference types="vite/client" />
```

### `frontend/tailwind.config.ts` (Code)

```typescript
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
```

### `frontend/tsconfig.app.json` (Config)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
```

### `frontend/tsconfig.json` (Config)

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "noImplicitAny": false,
    "noUnusedParameters": false,
    "skipLibCheck": true,
    "allowJs": true,
```

### `frontend/tsconfig.node.json` (Config)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
```

### `frontend/vite.config.ts` (Code)

```typescript
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  server: {
    host: "::",
    port: 8080,
    proxy: env.VITE_DEV_API_PROXY
      ? {
          // Dev-only proxy: set VITE_DEV_API_PROXY (e.g. the Railway backend URL)
```

### `frontend/vitest.config.ts` (Code)

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
```

### `package.json` (Config)

```json
{
    "name": "littlefounders-monorepo",
    "version": "1.0.0",
    "scripts": {
        "build": "cd frontend && npm install && npm run build && mkdir -p ../dist && cp -r dist/* ../dist"
    },
    "engines": {
        "node": "24.x"
    }
}
```

### `scripts/generate_repo_map.py` (Code)

```python
#!/usr/bin/env python3
"""
generate_repo_map.py — Generates `repo_map.md` at project root.

What it does:
  1. Builds a directory tree (excluding noise dirs).
  2. For every "code file", reads the first 15 lines and includes them
     as a fenced code block.
  3. Writes everything into REPO_MAP.md.

Code files = .ts, .tsx, .js, .jsx, .py, .css, .html
Config files  = .toml, .yaml, .yml
Config JSONs  = only those NOT in lesson_engine/ or i18n/ (excludes data JSONs)

Usage:
```

### `supabase/config.toml` (Config)

```toml
[api]
enabled = true
port = 54321
schemas = ["public", "auth", "storage"]

[db]
port = 54322
major_version = 15

[auth]
enabled = true

[storage]
enabled = true

```

### `supabase/functions/verify-password/index.ts` (Code)

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate that the request comes from an authenticated user
```

### `vercel.json` (Config)

```json
{
    "buildCommand": "cd frontend && npm install && npm run build",
    "outputDirectory": "frontend/dist",
    "rewrites": [
        {
            "source": "/((?!api/).*)",
            "has": [
                {
                    "type": "host",
                    "value": "en.littlefounders.ai"
                }
            ],
            "destination": "/index-en.html"
        },
        {
```

