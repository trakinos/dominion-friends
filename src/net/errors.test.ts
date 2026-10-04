import { describe, it, expect } from 'vitest';
import { describePeerError } from './errors';

describe('describePeerError', () => {
  it('explains known PeerJS error types', () => {
    expect(describePeerError({ type: 'peer-unavailable' })).toBe('Room not found. Check the code and try again.');
    expect(describePeerError({ type: 'network' })).toBe('Could not reach the connection server. Check your internet connection and try again.');
    expect(describePeerError({ type: 'server-error' })).toBe('Could not reach the connection server. Check your internet connection and try again.');
    expect(describePeerError({ type: 'browser-incompatible' })).toBe('This browser does not support peer-to-peer connections.');
  });

  it('falls back to the error message', () => {
    expect(describePeerError(new Error('Timed out'))).toBe('Timed out');
    expect(describePeerError(null)).toBe('Connection failed.');
  });
});
