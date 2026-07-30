/**
 * Estes tipos vivem em @quickfit/core porque têm DOIS consumidores: o painel
 * escreve o tema (com validação de contraste) e o totem o lê. Se morassem em
 * apps/totem, o core dependeria do app — inversão de dependência que a
 * separação totem/painel expôs.
 */
export type GymTheme = {
  accent: string;
  mode: 'dark' | 'light';
};

export type Gym = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  theme: GymTheme;
  trainerName: string | null;
  trainerCref: string | null;
};
