import type { Exercise, Input } from './types';

/**
 * Reduz o catálogo ao que esta unidade e este aluno podem fazer hoje.
 * É aqui que mora a garantia de segurança do produto.
 */
export function eligible(catalog: Exercise[], input: Input): Exercise[] {
  const gymHas = new Set(input.availableEquipment);

  return catalog.filter((ex) => {
    // `every`, não `some`: crucifixo na máquina exige a máquina de crucifixo.
    // Se a academia não tem — ou o gestor desligou por manutenção — o
    // exercício desaparece. Com `some` prescreveríamos aparelho inexistente.
    if (!ex.equipment.every((eq) => gymHas.has(eq))) return false;

    if (ex.level > input.level) return false;
    if (ex.contraindications.some((c) => input.avoid.includes(c))) return false;

    return (
      input.groups.includes(ex.primary) ||
      ex.secondary.some((g) => input.groups.includes(g))
    );
  });
}
