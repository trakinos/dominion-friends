import { describe, it, expect } from 'vitest';
import { cleanName, parseGuestMessage, parseHostMessage } from './protocol';

describe('cleanName', () => {
  it('trims, limits to 20 characters and defaults to Player', () => {
    expect(cleanName('  Ana  ')).toBe('Ana');
    expect(cleanName('x'.repeat(30))).toBe('x'.repeat(20));
    expect(cleanName('   ')).toBe('Player');
    expect(cleanName(42)).toBe('Player');
  });
});

describe('parseGuestMessage', () => {
  it('parses hello messages', () => {
    expect(parseGuestMessage({ type: 'hello', name: ' Ana ', token: 't1' })).toEqual({ type: 'hello', name: 'Ana', token: 't1' });
    expect(parseGuestMessage({ type: 'hello', name: 'Ana', token: 7 })).toEqual({ type: 'hello', name: 'Ana', token: null });
    expect(parseGuestMessage({ type: 'hello', name: 'Ana', token: 'x'.repeat(65) })).toEqual({ type: 'hello', name: 'Ana', token: null });
  });

  it('passes intents through for the engine to validate', () => {
    expect(parseGuestMessage({ type: 'intent', intent: { type: 'endPhase' } })).toEqual({ type: 'intent', intent: { type: 'endPhase' } });
    expect(parseGuestMessage({ type: 'intent', intent: { kind: 'x' } })).toBeNull();
    expect(parseGuestMessage({ type: 'intent' })).toBeNull();
  });

  it('parses setColor with a palette color only', () => {
    expect(parseGuestMessage({ type: 'setColor', color: 'pink' })).toEqual({ type: 'setColor', color: 'pink' });
    expect(parseGuestMessage({ type: 'setColor', color: 'orange' })).toBeNull();
    expect(parseGuestMessage({ type: 'setColor' })).toBeNull();
  });

  it('rejects anything else', () => {
    for (const raw of [null, 'hello', 42, [], { type: 'ping' }, {}]) expect(parseGuestMessage(raw)).toBeNull();
  });
});

describe('parseHostMessage', () => {
  it('parses each message type', () => {
    expect(parseHostMessage({ type: 'welcome', playerId: 'p1', token: 't' })).toEqual({ type: 'welcome', playerId: 'p1', token: 't' });
    expect(parseHostMessage({ type: 'lobby', lobby: { hostId: 'p0' } })?.type).toBe('lobby');
    expect(parseHostMessage({ type: 'view', view: { you: 0 } })?.type).toBe('view');
    expect(parseHostMessage({ type: 'error', reason: 'Room full' })).toEqual({ type: 'error', reason: 'Room full' });
  });

  it('rejects malformed messages', () => {
    for (const raw of [null, [], { type: 'welcome', playerId: 'p1' }, { type: 'lobby' }, { type: 'error' }, { type: 'nope' }]) {
      expect(parseHostMessage(raw)).toBeNull();
    }
  });
});
