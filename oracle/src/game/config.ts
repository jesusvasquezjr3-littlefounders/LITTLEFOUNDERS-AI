/*
 * GAME_AI_DEBRIEF — the operator switch for the one-line AI debrief after a game
 * race (game/line.ts, routes/game.ts).
 *
 * OFF unless it is exactly the string `on`: unset, empty, `ON`, `true`, `1` or a
 * typo all mean off, so the model can only be reached by a deliberate, spelled-out
 * yes. Core carries the same switch (backend GAME_AI_DEBRIEF) and BOTH must be on;
 * Core also needs the guardian's consent to the `game_ai_debrief` data practice and
 * a per-learner daily cap before it ever calls. Turn it on only after the cost per
 * line has been measured (docs/games/KARTRUSH-INTEGRATION-DESIGN.md section 4.2).
 *
 * Read from the process environment at CALL time, on purpose, not through env.ts:
 * env.ts is a governed Tier 1 file (the Mentor's configuration) and this switch
 * is not part of the Mentor, so it lives with the game code. It is documented here
 * and in backend/.env.example, and in oracle/.env.example as an example only.
 */
export function gameAiDebriefEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GAME_AI_DEBRIEF === 'on';
}
