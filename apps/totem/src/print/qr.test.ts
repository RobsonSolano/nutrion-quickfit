import { describe, it, expect } from 'vitest';
import { qrDataUrl, workoutUrl } from './qr';

describe('workoutUrl', () => {
  it('monta uma URL curta na origem atual', () => {
    const url = workoutUrl('abc1234567', 'https://quickfit.vercel.app');
    expect(url).toBe('https://quickfit.vercel.app/w/abc1234567');
  });

  it('não duplica a barra quando a base já termina em /', () => {
    expect(workoutUrl('x', 'https://a.com/')).toBe('https://a.com/w/x');
  });
});

describe('qrDataUrl', () => {
  it('devolve um data URL de PNG', async () => {
    const out = await qrDataUrl('https://quickfit.vercel.app/w/abc1234567');
    expect(out.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('URL curta gera QR de baixa densidade', async () => {
    // O nanoid de 10 chars existe para isto: QR pequeno lê rápido em câmera
    // ruim sob luz forte.
    const curto = await qrDataUrl('https://quickfit.vercel.app/w/abc1234567');
    const longo = await qrDataUrl('https://quickfit.vercel.app/w/' + 'x'.repeat(300));
    expect(curto.length).toBeLessThan(longo.length);
  });
});
