import { ChatItem, toHistory, withoutErrors } from '../../conversation';

describe('conversación en memoria', () => {
  const items: ChatItem[] = [
    { id: 1, kind: 'student', text: 'Hola' },
    { id: 2, kind: 'tutor', text: 'Pega tu enunciado.', diagram: null },
    { id: 3, kind: 'student', text: 'Enunciado...' },
    { id: 4, kind: 'error', text: 'El tutor no está disponible en este momento.' },
  ];

  it('el historial no incluye los avisos de error', () => {
    expect(toHistory(items)).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Pega tu enunciado.' },
      { role: 'user', content: 'Enunciado...' },
    ]);
  });

  it('reintentar reenvía el mismo historial sin duplicar el mensaje del estudiante', () => {
    const retried = withoutErrors(items);
    expect(retried.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(toHistory(retried)).toEqual(toHistory(items));
  });
});
