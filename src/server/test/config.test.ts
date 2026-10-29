import { describe, expect, test } from 'vitest';
import { DEFAULTS, readConfig } from '../src/config';

describe('game server: configuration', () => {
  test('the defaults', () => {
    expect(readConfig({})).toEqual({
      config: {
        port: 8080,
        allowedOrigins: null,
        maxRooms: 10,
        graceSeconds: 15,
        lobbyIdleMinutes: 30,
        testBot: false,
      },
    });
    expect(readConfig({ PORT: '', ALLOWED_ORIGINS: '  ', TEST_BOT: '' })).toEqual({ config: DEFAULTS });
  });

  test('every setting can be changed', () => {
    expect(
      readConfig({
        PORT: '3000',
        ALLOWED_ORIGINS: 'https://example.com, http://localhost:5173/',
        MAX_ROOMS: '25',
        GRACE_SECONDS: '20',
        LOBBY_IDLE_MINUTES: '7.5',
        TEST_BOT: 'on',
      }),
    ).toEqual({
      config: {
        port: 3000,
        allowedOrigins: ['https://example.com', 'http://localhost:5173'],
        maxRooms: 25,
        graceSeconds: 20,
        lobbyIdleMinutes: 7.5,
        testBot: true,
      },
    });
    for (const on of ['ON', 'true', 'yes', '1'])
      expect(readConfig({ TEST_BOT: on })).toMatchObject({ config: { testBot: true } });
    for (const off of ['Off', 'false', 'no', '0'])
      expect(readConfig({ TEST_BOT: off })).toMatchObject({ config: { testBot: false } });
  });

  test('Bad setting', () => {
    const result = readConfig({ MAX_ROOMS: 'lots' });
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toMatch(/^MAX_ROOMS is invalid/);
  });

  test('every bad value names its variable', () => {
    const bad: Record<string, string[]> = {
      PORT: ['http', '-1', '70000', '80.5'],
      ALLOWED_ORIGINS: ['example.com', 'https://example.com/games', ',', 'https://a.com,nope'],
      MAX_ROOMS: ['0', '2.5', 'ten'],
      GRACE_SECONDS: ['0', '-5', 'soon', '601'],
      LOBBY_IDLE_MINUTES: ['0', 'forever'],
      TEST_BOT: ['maybe'],
    };
    for (const [name, values] of Object.entries(bad)) {
      for (const value of values) {
        const result = readConfig({ [name]: value });
        expect('error' in result && result.error.startsWith(`${name} is invalid`), `${name}=${value}`).toBe(
          true,
        );
      }
    }
  });
});
