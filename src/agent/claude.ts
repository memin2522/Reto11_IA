// Port de app/llm/claude_agent.py: bucle de herramientas con la API de Mensajes de Claude.
import { API_KEYS } from '../config';
import {
  AgentError, AgentReply, ChatTurn, executeTool, MAX_ITERATIONS, MODEL_SCHEMA, pyJson, SYSTEM_PROMPT,
  TOOL_DESCRIPTION, TOOL_NAME,
} from './common';
import { postJson } from './http';

export const URL = 'https://api.anthropic.com/v1/messages';
export const MODEL = 'claude-sonnet-5-5';
// low: punto de partida recomendado para chat; subirlo a medium si la prueba muestra errores al extraer el modelo
export const EFFORT = 'low';
export const MAX_TOKENS = 16000;

export const TOOLS = [
  { name: TOOL_NAME, description: TOOL_DESCRIPTION, strict: true, input_schema: MODEL_SCHEMA },
];

// Herramientas + prompt son iguales para todos los estudiantes: este breakpoint los deja en caché
const SYSTEM = [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }];

export async function runClaude(history: ChatTurn[]): Promise<AgentReply> {
  const messages: unknown[] = history.map((m) => ({ role: m.role, content: m.content }));
  let diagram: string | null = null;
  const headers = {
    'x-api-key': API_KEYS.claude,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // En la última vuelta se obliga a responder con texto
    const toolChoice = iteration === MAX_ITERATIONS - 1 ? { type: 'none' } : { type: 'auto' };
    // cache_control de primer nivel: la conversación también se lee de caché entre vueltas del bucle
    const response = await postJson(URL, headers, {
      model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, messages, tools: TOOLS,
      tool_choice: toolChoice, output_config: { effort: EFFORT }, cache_control: { type: 'ephemeral' },
    });

    const content: any[] = Array.isArray(response?.content) ? response.content : [];
    // Si se cortó por max_tokens, los argumentos de la herramienta pueden estar incompletos
    const calls = response?.stop_reason === 'max_tokens' ? [] : content.filter((b) => b.type === 'tool_use');

    if (response?.stop_reason === 'refusal') {
      throw new AgentError(`Claude declined the request: ${JSON.stringify(response.stop_details ?? null)}`);
    }

    if (!calls.length) {
      const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      if (!text) throw new AgentError(`Empty reply (stop_reason=${response?.stop_reason}).`);
      return { text, diagram };
    }

    // El turno completo vuelve sin cambios, incluidos los bloques de razonamiento
    messages.push({ role: 'assistant', content });
    const results = calls.map((call) => {
      const { result, mermaid } = executeTool(call.name, call.input);
      diagram = mermaid ?? diagram;
      return { type: 'tool_result', tool_use_id: call.id, content: pyJson(result), is_error: 'error' in result };
    });
    messages.push({ role: 'user', content: results });
  }

  throw new AgentError('The agent exceeded the maximum number of iterations.');
}
