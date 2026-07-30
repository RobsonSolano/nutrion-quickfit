import QRCode from 'qrcode';

/**
 * O default é lido de `window` mas com guarda: sem ela, importar este módulo
 * em ambiente `node` (é o que o vitest usa) explode com `ReferenceError` no
 * primeiro teste que chamar sem `base`. A guarda deixa a função utilizável nos
 * dois mundos sem ninguém precisar montar um DOM falso só para testar
 * concatenação de string.
 */
export function workoutUrl(
  id: string,
  base = typeof window === 'undefined' ? '' : window.location.origin,
): string {
  return `${base.replace(/\/$/, '')}/w/${id}`;
}

/** Gerado no cliente — não depende de serviço externo, funciona offline. */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    color: { dark: '#14170F', light: '#FFFFFF' },
  });
}
