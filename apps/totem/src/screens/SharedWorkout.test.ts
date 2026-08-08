import { describe, it, expect } from 'vitest';
import { splitImageCredit, hasSecondFrame } from './SharedWorkout';

describe('splitImageCredit', () => {
  it('sem fragmento de crédito, devolve a URL inteira e credit null', () => {
    const url = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Pullups/0.jpg';
    expect(splitImageCredit(url)).toEqual({ base: url, credit: null });
  });

  it('com fragmento de crédito, separa a URL base do texto decodificado', () => {
    const url = 'https://wger.de/media/exercise-images/960/x.png#credit=wger.de%20(CC%20BY-SA%204.0)';
    expect(splitImageCredit(url)).toEqual({
      base: 'https://wger.de/media/exercise-images/960/x.png',
      credit: 'wger.de (CC BY-SA 4.0)',
    });
  });
});

describe('hasSecondFrame', () => {
  it('URL do Free Exercise DB (termina em /0.jpg) tem segunda posição', () => {
    expect(hasSecondFrame('https://cdn.jsdelivr.net/.../Pullups/0.jpg')).toBe(true);
  });

  it('imagem única do wger (.png, não termina em /0.jpg) não tem segunda posição', () => {
    // Bug que este teste tranca: sem essa checagem, as setas ‹ › e os 2
    // pontinhos apareciam mesmo quando as duas "posições" eram a mesma
    // imagem — porque frameUrl() não achava "/0.jpg" pra trocar e devolvia
    // a URL original sem alteração nos dois frames.
    expect(hasSecondFrame('https://wger.de/media/exercise-images/960/x.png')).toBe(false);
  });
});
