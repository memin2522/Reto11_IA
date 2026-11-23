// Port de app/llm/openai_agent.py: bucle de herramientas con la API de Respuestas de OpenAI.
import { API_KEYS } from '../config';
import {
  AgentError, AgentReply, ChatTurn, executeTool, MAX_ITERATIONS, MODEL_SCHEMA, pyJson, SYSTEM_PROMPT,
  TOOL_DESCRIPTION, TOOL_NAME,
} from './common';
import { postJson } from './http';

export const URL = 'https://api.openai.com/v1/responses';
export const MODEL = 'gpt-5.6-luna';

export const TOOLS = [
  { type: 'function', name: TOOL_NAME, description: TOOL_DESCRIPTION, strict: true, parameters: MODEL_SCHEMA },
];

/** model_dump(exclude_none=True): los items se reenvían sin los campos nulos. */
function withoutNulls(value: any): any {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, withoutNulls(v)]));
  }
  return value;
}

/** Equivalente a response.output_text del SDK. */
function outputText(output: any[]): string {
  return output
    .filter((item) => item.type === 'message')
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('');
}

export async function runOpenAI(history: ChatTurn[]): Promise<AgentReply> {
  const items: unknown[] = history.map((m) => ({ role: m.role, content: m.content }));
  let diagram: string | null = null;
  const headers = { authorization: `Bearer ${API_KEYS.openai}`, 'content-type': 'application/json' };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // En la última vuelta se obliga a responder con texto
    const toolChoice = iteration === MAX_ITERATIONS - 1 ? 'none' : 'auto';
    // store=false: OpenAI no conserva la conversación. El razonamiento viaja cifrado
    // entre vueltas del bucle para que el modelo no lo pierda al usar la herramienta.
    const response = await postJson(URL, headers, {
      model: MODEL, instructions: SYSTEM_PROMPT, input: items, tools: TOOLS,
      tool_choice: toolChoice, store: false, include: ['reasoning.encrypted_content'],
    });

    const output: any[] = Array.isArray(response?.output) ? response.output : [];
    const calls = output.filter((item) => item.type === 'function_call');

    if (!calls.length) {
      const text = outputText(output);
      if (!text) throw new AgentError(`Empty reply (status=${response?.status}).`);
      return { text, diagram };
    }

    items.push(...output.map(withoutNulls));
    for (const call of calls) {
      const { result, mermaid } = executeTool(call.name, call.arguments);
      diagram = mermaid ?? diagram;
      items.push({ type: 'function_call_output', call_id: call.call_id, output: pyJson(result) });
    }
  }

  throw new AgentError('The agent exceeded the maximum number of iterations.');
}
