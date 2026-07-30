import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from './index';

describe('engine', () => {
  it('expõe uma versão', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
