import { describe, it, expect } from 'vitest';
// Import pelo NOME do pacote, como as telas farão. Se o alias estiver errado,
// este teste avisa agora — não como erro de build na task 14.
import { ENGINE_VERSION } from '@quickfit/core/engine';

describe('resolução do workspace', () => {
  it('apps/totem importa @quickfit/core/engine', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
