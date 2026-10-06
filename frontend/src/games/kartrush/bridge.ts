import { LF_HELLO, parseGameMessage, parseHostMessage, type GameMessage, type HostMessage } from './protocol';

/*
 * The host end of the `kr.v1` handshake and the port every later message uses
 * (KRV1-CONTRACT §2).
 *
 *   1. The SPA builds the iframe and waits for its `load` event.
 *   2. It posts ONE window message, `{ t: 'lf.hello', v: 1 }`, to the game's
 *      origin with one transferred `MessagePort`.
 *   3. The game answers on that port with `kr.ready`; only then is the session
 *      open and anything else accepted.
 *
 * WHY A PORT AND NOT `window.postMessage` FOR EVERYTHING. After the hello the
 * traffic travels on a private channel only the two ends hold, so nothing a
 * third page posts to the SPA's window can reach the controller, and the host
 * never has to trust `event.origin` for a save or a run report.
 *
 * A message that fails validation (unknown type, wrong version, extra field,
 * wrong type, out-of-range number) is DROPPED and reported, never coerced. If
 * the game is not ready 20 s after the bridge starts, the bridge fails and the
 * screen shows its error state: a learner is never left on an empty frame.
 */

/** Contract: the handshake times out after 20 seconds. */
export const HANDSHAKE_TIMEOUT_MS = 20_000;

/** The subset of `MessagePort` the bridge uses, so a test can drive it without a real channel. */
export interface PortLike {
  postMessage(message: unknown): void;
  start?(): void;
  close(): void;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onmessageerror: ((event: unknown) => void) | null;
}

/** The subset of an iframe element the bridge uses. */
export interface FrameLike {
  addEventListener(type: 'load', listener: () => void): void;
  removeEventListener(type: 'load', listener: () => void): void;
  readonly contentWindow: { postMessage(message: unknown, targetOrigin: string, transfer: Transferable[]): void } | null;
}

export interface BridgeChannel { readonly port1: PortLike; readonly port2: unknown }

export type BridgeFailure = 'timeout' | 'hello';

export interface GameBridgeOptions {
  readonly frame: FrameLike;
  /** The iframe's origin: the hello's `targetOrigin`. Always an entry of the allow-list. */
  readonly gameOrigin: string;
  readonly timeoutMs?: number;
  readonly createChannel?: () => BridgeChannel;
  readonly onReady: (build: string) => void;
  /** Every validated message after `kr.ready`. */
  readonly onMessage: (message: GameMessage) => void;
  readonly onFailure: (reason: BridgeFailure) => void;
  /** A message that was refused, either direction. Defaults to a console warning. */
  readonly onDrop?: (reason: string, direction: 'inbound' | 'outbound') => void;
}

export type BridgeState = 'idle' | 'waiting-load' | 'waiting-ready' | 'ready' | 'failed' | 'closed';

export class GameBridge {
  private stateValue: BridgeState = 'idle';
  private port: PortLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onLoad = (): void => this.sendHello();

  constructor(private readonly options: GameBridgeOptions) {}

  get state(): BridgeState {
    return this.stateValue;
  }

  /** Starts waiting for the frame's `load`, then the hello and the game's `kr.ready`. */
  connect(): void {
    if (this.stateValue !== 'idle') return;
    this.stateValue = 'waiting-load';
    this.options.frame.addEventListener('load', this.onLoad);
    this.timer = setTimeout(() => this.fail('timeout'), this.options.timeoutMs ?? HANDSHAKE_TIMEOUT_MS);
  }

  private sendHello(): void {
    // A frame that navigates (a redirect inside the game) fires `load` again: one hello only.
    if (this.stateValue !== 'waiting-load') return;
    const target = this.options.frame.contentWindow;
    if (!target) return this.fail('hello');
    const channel = this.options.createChannel ? this.options.createChannel() : (new MessageChannel() as unknown as BridgeChannel);
    const port = channel.port1;
    this.port = port;
    port.onmessage = (event) => this.receive(event.data);
    port.onmessageerror = () => this.drop('a port message could not be deserialised', 'inbound');
    port.start?.();
    this.stateValue = 'waiting-ready';
    try {
      target.postMessage(LF_HELLO, this.options.gameOrigin, [channel.port2 as Transferable]);
    } catch {
      this.fail('hello');
    }
  }

  /** Validates and delivers one inbound payload. Public so a test can inject a message directly. */
  receive(raw: unknown): void {
    if (this.stateValue !== 'waiting-ready' && this.stateValue !== 'ready') return;
    const parsed = parseGameMessage(raw);
    if (!parsed.ok) return this.drop(parsed.reason, 'inbound');
    const message = parsed.value;
    if (this.stateValue === 'waiting-ready') {
      // Until the game says it is ready nothing else is meaningful; a second `kr.ready` later is as meaningless.
      if (message.t !== 'kr.ready') return this.drop(`${message.t} before kr.ready`, 'inbound');
      this.stateValue = 'ready';
      this.clearTimer();
      this.options.onReady(message.build);
      return;
    }
    if (message.t === 'kr.ready') return this.drop('kr.ready twice', 'inbound');
    this.options.onMessage(message);
  }

  /** Sends one host message after validating it against the same schemas the game applies. False when it was not sent. */
  send(message: HostMessage): boolean {
    if (this.stateValue !== 'ready' || !this.port) return false;
    const checked = parseHostMessage(message);
    if (!checked.ok) {
      this.drop(`${message.t}: ${checked.reason}`, 'outbound');
      return false;
    }
    this.port.postMessage(checked.value);
    return true;
  }

  dispose(): void {
    if (this.stateValue === 'closed') return;
    this.stateValue = 'closed';
    this.clearTimer();
    this.options.frame.removeEventListener('load', this.onLoad);
    this.closePort();
  }

  private fail(reason: BridgeFailure): void {
    if (this.stateValue === 'failed' || this.stateValue === 'closed' || this.stateValue === 'ready') return;
    this.stateValue = 'failed';
    this.clearTimer();
    this.options.frame.removeEventListener('load', this.onLoad);
    this.closePort();
    this.options.onFailure(reason);
  }

  private closePort(): void {
    if (!this.port) return;
    this.port.onmessage = null;
    this.port.onmessageerror = null;
    this.port.close();
    this.port = null;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private drop(reason: string, direction: 'inbound' | 'outbound'): void {
    if (this.options.onDrop) this.options.onDrop(reason, direction);
    else console.warn(`[kartrush] dropped ${direction} message: ${reason}`);
  }
}
