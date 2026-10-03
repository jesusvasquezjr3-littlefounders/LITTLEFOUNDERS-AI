import { createContext, useContext } from 'react';
import type { ArConsent, ArObjectId } from '../ar.generated';

/*
 * F4.9: what the AR pilot depends on, injected so a test (and, later, the app) can supply it. The default is closed on every
 * count: the flag is off unless the build sets VITE_HORIZONTE_AR_PILOT=true, and no consent record exists yet, so a production
 * build can never open the gate. The age is real: with the flag on and no age supplied, the board reads the learner's age band
 * from Core (ar/ArLearnerAge.tsx), and an unknown age keeps the pilot closed. Consent comes from this environment only; recording
 * a verified guardian's consent in Core is an owner follow-up, and the pilot must not be enabled before the legal and pediatric
 * review (docs/rebuild/sprints/horizonte/space2.md).
 */

/** The part of a WebXR session the pilot touches. Structural on purpose: no SDK, and no global type is required to compile. */
export interface ArXrSession {
  end(): Promise<void>;
  addEventListener(type: 'end', listener: () => void, options?: { once?: boolean }): void;
}

/** The part of `navigator.xr` the pilot touches. */
export interface ArXrSystem {
  /** Asks the browser whether AR sessions exist at all. It never opens the camera and never prompts. */
  isSessionSupported(mode: 'immersive-ar'): Promise<boolean>;
  /** Opens the camera view. It prompts the browser's own permission, so it is called only after the in-app consent. */
  requestSession(mode: 'immersive-ar', init: { requiredFeatures: string[]; optionalFeatures: string[] }): Promise<ArXrSession>;
}

export interface ArStartInput {
  xr: ArXrSystem;
  object: ArObjectId;
  onEnd: () => void;
}

/** A running AR session: ending it releases the camera and the renderer. */
export interface ArSessionHandle { end(): void }

export interface ArPilotEnvironment {
  /** The feature flag. Off by default. */
  flag: boolean;
  /** Recorded consent, or null when none is recorded (always null until Core can record a verified guardian's consent). */
  consent: ArConsent | null;
  /**
   * The learner's age in whole years when the app already knows it. Absent, the board asks Core for the learner's age band
   * (only when the flag is on); null means no usable age, and the pilot stays closed. There is no fallback to the lesson's age.
   */
  age?: number | null;
  /** The browser's WebXR system, or null where there is none. Read lazily, only when the gate is open. */
  xr: () => ArXrSystem | null;
  /** Starts a session. The default loads the three.js session module on demand. */
  start: (input: ArStartInput) => Promise<ArSessionHandle>;
}

/**
 * The only session the pilot ever asks for: the device's AR view with hit-testing, to find the table. The camera feed is the
 * browser's own and goes straight to the screen; the pilot never asks for pixel access to it, so no frame can be read here.
 */
export const arSessionInit = (): { requiredFeatures: string[]; optionalFeatures: string[] } => ({ requiredFeatures: ['hit-test'], optionalFeatures: ['local-floor'] });

export const defaultArPilot: ArPilotEnvironment = {
  flag: import.meta.env.VITE_HORIZONTE_AR_PILOT === 'true',
  consent: null,
  xr: () => (typeof navigator === 'undefined' ? null : (navigator as unknown as { xr?: ArXrSystem }).xr ?? null),
  start: (input) => import('./arSession').then((module) => module.startArSession(input)),
};

export const ArPilotContext = createContext<ArPilotEnvironment>(defaultArPilot);
export const useArPilot = (): ArPilotEnvironment => useContext(ArPilotContext);
