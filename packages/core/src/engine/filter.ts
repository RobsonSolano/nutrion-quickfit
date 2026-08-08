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

    // Mobilidade é o único objetivo que prescreve alongamento; os outros quatro
    // prescrevem treino. Sem esta cláusula o motor mistura os dois, e a ficha
    // sai com "Foam roll quadríceps 3x8-12".
    const querMobilidade = input.goal === 'mobilidade';
    if (querMobilidade !== (ex.kind === 'mobilidade')) return false;

    if (ex.level > input.level) return false;
    if (ex.contraindications.some((c) => input.avoid.includes(c))) return false;

    if (input.groups.includes(ex.primary)) return true;

    // Grupo secundário só conta pra padrão DINÂMICO (agachamento recruta
    // glúteo, remada recruta bíceps). Isométrico (`iso`) é sustentar uma
    // postura — o envolvimento de um grupo secundário ali não justifica
    // aparecer como "exercício de perna": prancha tem perna/glúteo como
    // secundário e vazava pra "Perna completa" (bug real, ago/2026).
    if (ex.pattern === 'iso') return false;

    return ex.secondary.some((g) => input.groups.includes(g));
  });
}
