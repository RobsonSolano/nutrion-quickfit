import { supabase } from './supabase';
import type { Contra, Exercise, Kind, MuscleGroup, Pattern } from '@quickfit/core/engine';
import type { Gym, GymTheme } from '@quickfit/core/theme';

// v2: a v1 não tinha o campo `kind` em Exercise (task 9b). Um cache escrito
// antes disso hidrataria exercícios com `kind: undefined`, e o filtro de
// mobilidade (`querMobilidade !== (ex.kind === 'mobilidade')`) trataria isso
// como treino em todo objetivo — o exato bug que a task 9b existe pra evitar.
export const CACHE_KEY = 'qf.catalog.v2';

// `Gym` e `GymTheme` são definidos em @quickfit/core/theme porque o painel
// também os consome. Re-exportados aqui só por conveniência de import nas telas.
export type { Gym, GymTheme } from '@quickfit/core/theme';

export type CatalogBundle = {
  exercises: Exercise[];
  gym: Gym;
  availableEquipment: string[];
  fromCache: boolean;
};

export function writeCache(bundle: CatalogBundle): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...bundle, fromCache: undefined }));
  } catch {
    // Cota cheia ou modo privado. O totem funciona sem cache — só não
    // sobrevive a queda de internet.
  }
}

export function hydrateFromCache(): CatalogBundle | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogBundle>;
    if (!parsed.exercises?.length || !parsed.gym || !parsed.availableEquipment) return null;
    return { ...(parsed as CatalogBundle), fromCache: true };
  } catch {
    return null;
  }
}

type ExerciseRow = {
  id: string;
  name: string;
  primary_group: MuscleGroup;
  level: 1 | 2 | 3;
  pattern: Pattern;
  kind: Kind;
  is_compound: boolean;
  avg_sec_per_set: number;
  duration_sec: number | null;
  cue: string | null;
  video_url: string | null;
  exercise_secondary_groups: { group_id: MuscleGroup }[];
  exercise_equipment: { equipment_id: string }[];
  exercise_contraindications: { tag: Contra }[];
};

/**
 * Busca catálogo + academia + equipamento disponível. Se a rede falhar, cai
 * para o cache. Se não houver cache, lança — a tela mostra "totem
 * indisponível" em vez de tela branca.
 */
export async function loadCatalog(gymSlug = 'demo'): Promise<CatalogBundle> {
  try {
    const [exRes, gymRes] = await Promise.all([
      supabase.from('exercises').select(
        `id, name, primary_group, level, pattern, kind, is_compound, avg_sec_per_set,
         duration_sec, cue, video_url,
         exercise_secondary_groups(group_id),
         exercise_equipment(equipment_id),
         exercise_contraindications(tag)`,
      ),
      supabase
        .from('gyms')
        .select('id, slug, name, logo_url, theme, trainer_name, trainer_cref')
        .eq('slug', gymSlug)
        .single(),
    ]);

    if (exRes.error) throw exRes.error;
    if (gymRes.error) throw gymRes.error;

    const eqRes = await supabase
      .from('gym_available_equipment')
      .select('equipment_id')
      .eq('gym_id', gymRes.data.id);
    if (eqRes.error) throw eqRes.error;

    const exercises: Exercise[] = (exRes.data as ExerciseRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      primary: r.primary_group,
      secondary: r.exercise_secondary_groups.map((s) => s.group_id),
      equipment: r.exercise_equipment.map((e) => e.equipment_id),
      level: r.level,
      pattern: r.pattern,
      kind: r.kind,
      isCompound: r.is_compound,
      avgSecPerSet: r.avg_sec_per_set,
      durationSec: r.duration_sec ?? undefined,
      contraindications: r.exercise_contraindications.map((c) => c.tag),
      cue: r.cue ?? undefined,
      videoUrl: r.video_url ?? undefined,
    }));

    if (exercises.length === 0) throw new Error('catálogo vazio no servidor');

    const g = gymRes.data;
    const bundle: CatalogBundle = {
      exercises,
      gym: {
        id: g.id,
        slug: g.slug,
        name: g.name,
        logoUrl: g.logo_url,
        theme: (g.theme ?? { accent: '#39FF14', mode: 'dark' }) as GymTheme,
        trainerName: g.trainer_name,
        trainerCref: g.trainer_cref,
      },
      availableEquipment: eqRes.data.map((e) => e.equipment_id),
      fromCache: false,
    };

    writeCache(bundle);
    return bundle;
  } catch (err) {
    const cached = hydrateFromCache();
    if (cached) {
      console.warn('Catálogo veio do cache — rede indisponível.', err);
      return cached;
    }
    throw new Error(
      'Não foi possível carregar o catálogo e não há cache local.',
      { cause: err },
    );
  }
}
