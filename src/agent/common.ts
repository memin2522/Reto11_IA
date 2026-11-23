// Lo que comparten ambos proveedores: errores, historial y ejecución de la herramienta.
// Port de app/llm/common.py sin base de datos ni registro de llamadas.
import { TOOL_NAME } from './definicion';
import { InvalidModel, review, toMermaid, validate } from './erModel';

export { MAX_ITERATIONS, MAX_RETRIES, REQUEST_TIMEOUT_S, SYSTEM_PROMPT, TOOL_DESCRIPTION, TOOL_NAME, MODEL_SCHEMA } from './definicion';

/** Turno de la conversación tal como lo guarda la app (texto plano). */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentReply {
  text: string;
  diagram: string | null;
}

/** El proveedor no respondió o la respuesta no es utilizable. El mensaje es técnico (para la consola). */
export class AgentError extends Error {}

export type ToolResult = { dibujado: true; senales: ReturnType<typeof review> } | { error: string };

/** Ejecuta dibujar_modelo y, a continuación, la revisión estructural sobre el mismo modelo.
 *  arguments llega como texto JSON (OpenAI) o ya decodificado (Claude). */
export function executeTool(name: string, args: unknown): { result: ToolResult; mermaid: string | null } {
  let model: unknown;
  try {
    model = typeof args === 'string' ? JSON.parse(args) : args;
    if (name !== TOOL_NAME) throw new InvalidModel(`Unknown tool '${name}'.`);
    validate(model);
  } catch (e) {
    // El resultado vuelve al modelo para que corrija los argumentos
    if (e instanceof SyntaxError || e instanceof InvalidModel) {
      return { result: { error: e.message }, mermaid: null };
    }
    throw e;
  }
  return { result: { dibujado: true, senales: review(model) }, mermaid: toMermaid(model) };
}

/** json.dumps(result, ensure_ascii=False) de Python usa ", " y ": " como separadores. */
export function pyJson(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return '[' + value.map(pyJson).join(', ') + ']';
  if (typeof value === 'object') {
    return '{' + Object.entries(value as object).map(([k, v]) => `${JSON.stringify(k)}: ${pyJson(v)}`).join(', ') + '}';
  }
  return JSON.stringify(value);
}

/** Registra el detalle técnico solo en desarrollo. Nunca incluye claves: no se registran cabeceras. */
export function logDev(...args: unknown[]): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[tutor]', ...args);
}
