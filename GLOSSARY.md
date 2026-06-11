# GLOSSARY.md — Términos Canónicos

> **Propósito:** Definiciones precisas para mantener consistencia en código, documentación y comunicación del equipo.

---

## A

- **Achievement:** Logro desbloqueable por el usuario al completar hitos específicos (lecciones, rachas, juegos). Almacenado en las tablas `Achievement` y `UserAchievement`.
- **Adventure:** Nivel superior del contenido educativo. Cada Adventure contiene múltiples Sagas.
- **Admin:** Usuario con permisos de administración para gestionar contenido, usuarios y reportes.
- **Audio Factory:** Pipeline de generación de TTS (Text-to-Speech) para narraciones y personajes. Código en `backend/audio_factory/`.
- **Audit Trail (Content Edit History):** Registro de cambios en contenido educativo con soporte para rollback. Implementado en `backend/admin/services.py`.

## B

- **Banking:** Sistema de banca virtual infantil dentro de la plataforma. Incluye `balance`, `SavingsGoal`, `Transaction`, `Product`, `Purchase` en el modelo de datos.

## C

- **Character:** Entidad de personaje narrativo (Dina, Dino, Dr. Rho, ZaraVex, Liruf). Modelo ORM en `backend/models.py`. Cada character tiene `code`, `name`, `description` y gestos asociados.
- **Child / Niño:** Usuario del perfil infantil (menor de edad), con acceso a lecciones y juegos educativos.
- **Content Edit History:** Ver **Audit Trail**.

## D

- **Dina:** Personaje narrativo femenino del universo LittleFounders.
- **Dino:** Personaje narrativo principal del universo LittleFounders.
- **Dr. Rho:** Personaje mentor/rival. Experto en economía.

## E

- **Exercise:** Componente interactivo dentro de una lección (multiple choice, fill blank, etc).
- **Exercise Type:** Categoría de ejercicio (quiz, drag-drop, slider, etc.). El sistema soporta 50+ tipos.

## F

- **Follow:** Conexión social entre usuarios. Sistema implementado en `backend/social/endpoints.py`.

## G

- **Game:** Aplicación interactiva standalone dentro de la plataforma (ChronoBloom, Paper Detective, NamVsYum, Hacker Defense, Nectar of Shadows, Paper Coin).
- **Gemini (Google Gemini):** Modelo de IA utilizado como alternativa a DeepSeek para generación de contenido. Referenciado en la arquitectura de BACKEND_GUIDE.md.
- **Gesture:** Animación/expresión de un personaje. Mapeo de nombres alternativos en `backend/utils/gesture_mapper.py`.
- **Guest / Guest Merge:** Usuario anónimo que juega sin registro. Al autenticarse, el endpoint `/auth/merge-guest` fusiona su progreso con la cuenta permanente.

## L

- **Lesson:** Unidad mínima de aprendizaje. Contiene ejercicios, narrativa y evaluación.
- **Lesson Code:** Identificador jerárquico con formato `{adventure}-{saga}-{topic}-{lesson}` (ej: `1-1-1-1`). Usado como clave única en URLs y referencias.
- **Lesson Engine:** Sistema backend (`/lesson-engine`) que orquesta la navegación, ejecución y progreso de lecciones. Endpoints públicos con auth opcional. 50+ tipos de ejercicio, audio granular por segmento, y cálculo de rachas.
- **Lesson Factory:** Pipeline de generación IA de lecciones (DeepSeek) con currículum estructurado, validación pedagógica y 5 fases cognitivas por concepto. Produce los JSON en `lesson_engine/littlefounders_lessons/`.
- **LF Audio Engine:** Servicio externo de TTS para generación de audio narrativo. Cliente en `backend/scripts/lf_audio_client.py`.
- **Liruf:** Personaje narrador principal. Código de voz `liruf`. Narrador predeterminado en el sistema de audio.

## N

- **Notification:** Mensaje dirigido o broadcast a usuarios. Sistema completo en `backend/notifications/` con endpoints, helpers y schemas propios.

## P

- **Parent / Padre:** Usuario con perfil parental, puede gestionar hijos y ver progreso.
- **Placement Exam:** Examen de ubicación inicial para determinar el nivel del estudiante.
- **Public ID:** UUID (v4) expuesto al frontend para identificar entidades, vs. el `id` interno (entero autoincremental) usado solo para joins internos.
- **Points Reward:** Puntos otorgados al completar una lección.

## R

- **Report:** Reporte de feedback/bug enviado por usuarios. Sistema con rate limiting en `backend/reports/`. Estados: `pending`, `reviewed`, `resolved`.

## S

- **Saga:** Sub-nivel de Adventure. Grupo de Topics relacionados narrativamente.
- **Savings Goal:** Meta de ahorro definida por un usuario infantil. Tabla ORM `SavingsGoal` en `backend/models.py`.
- **Social:** Módulo de red social interna (perfiles públicos, follows). Implementado en `backend/social/`.
- **Streak:** Rachas diarias de actividad del usuario. La lógica usa fecha local (`YYYY-MM-DD`) enviada por el frontend.

## T

- **Task:** Tarea asignada por un padre a un hijo. Modelo con categorías (`TaskCategory`) y dificultad (`TaskDifficulty`).
- **Topic:** Sub-nivel de Saga. Grupo de Lessons sobre un tema específico.
- **Transaction:** Movimiento financiero en el sistema de banca virtual. Asociado a `SavingsGoal`, `Product` o `Purchase`.
- **TTS:** Text-to-Speech, generación de audio narrativo.

## U

- **User Type:** Tipo de usuario en el sistema. Valores: `universal` (predeterminado), `tutor` (padre), `child` (niño), `admin`. Determina permisos y acceso a rutas.

## Z

- **ZaraVex:** Personaje femenino del universo LittleFounders.
