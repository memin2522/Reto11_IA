// Estado de la conversación: vive solo en memoria (estado de React). Nada se guarda.
import type { ChatTurn } from './agent';

export type ChatItem =
  | { id: number; kind: 'student'; text: string }
  | { id: number; kind: 'tutor'; text: string; diagram: string | null }
  | { id: number; kind: 'error'; text: string };

let nextId = 1;
export const newId = () => nextId++;

/** Lo que se envía al modelo: solo los turnos del estudiante y del tutor, en texto plano.
 *  Los avisos de error no forman parte del historial. */
export function toHistory(items: ChatItem[]): ChatTurn[] {
  return items.flatMap((item): ChatTurn[] => {
    if (item.kind === 'student') return [{ role: 'user', content: item.text }];
    if (item.kind === 'tutor') return [{ role: 'assistant', content: item.text }];
    return [];
  });
}

/** Quita los avisos de error: al reintentar o al enviar otro mensaje, el aviso desaparece. */
export function withoutErrors(items: ChatItem[]): ChatItem[] {
  return items.filter((item) => item.kind !== 'error');
}
