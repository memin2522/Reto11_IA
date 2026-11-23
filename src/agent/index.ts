// Punto de entrada del agente: la interfaz solo usa runAgent.
import { Provider } from '../config';
import { AgentReply, ChatTurn, logDev } from './common';
import { runClaude } from './claude';
import { runOpenAI } from './openai';

export type { AgentReply, ChatTurn } from './common';

export const TUTOR_UNAVAILABLE = 'El tutor no está disponible en este momento.';

/** Envía el historial al proveedor elegido. Cualquier fallo llega como Error con un mensaje en español. */
export async function runAgent(provider: Provider, history: ChatTurn[]): Promise<AgentReply> {
  try {
    return provider === 'claude' ? await runClaude(history) : await runOpenAI(history);
  } catch (e) {
    logDev(`${provider} failed:`, e instanceof Error ? e.message : e);
    throw new Error(TUTOR_UNAVAILABLE);
  }
}
