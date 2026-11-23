// Bucle de herramientas de cada proveedor con fetch simulado.
jest.mock('../../config', () => ({
  API_KEYS: { claude: 'test-anthropic', openai: 'test-openai' },
  isAvailable: () => true,
}));

import esperados from './esperados.json';
import { runAgent, TUTOR_UNAVAILABLE } from '../index';
import { runClaude } from '../claude';
import { runOpenAI } from '../openai';
import { postJson } from '../http';

const modelo = esperados.casos.find((c) => c.nombre === 'academia_completa')!;
const history = [{ role: 'user' as const, content: 'Hola' }];

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const status = (code: number) => Promise.resolve(new Response('{"error":"x"}', { status: code }));

let fetchMock: jest.Mock;
const sentBodies = () => fetchMock.mock.calls.map(([, init]: [string, { body: string }]) => JSON.parse(init.body));

beforeEach(() => {
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ── Claude ──────────────────────────────────────────────────────────

const claudeText = (text: string, stop_reason = 'end_turn') => ({
  content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text }], stop_reason,
});
const claudeTool = (input: unknown, id = 'toolu_1') => ({
  content: [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'tool_use', id, name: 'dibujar_modelo', input },
  ],
  stop_reason: 'tool_use',
});

describe('Claude', () => {
  it('responde con texto directo y envía los parámetros de Python', async () => {
    fetchMock.mockReturnValueOnce(ok(claudeText('Hola, pega tu enunciado.')));
    await expect(runClaude(history)).resolves.toEqual({ text: 'Hola, pega tu enunciado.', diagram: null });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toMatchObject({
      'x-api-key': 'test-anthropic', 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
    });
    const body = sentBodies()[0];
    expect(body).toMatchObject({
      model: 'claude-sonnet-5-5', max_tokens: 16000, output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' }, tool_choice: { type: 'auto' }, messages: history,
    });
    expect(body.system).toEqual([{ type: 'text', text: esperados.system_prompt, cache_control: { type: 'ephemeral' } }]);
    expect(body.tools).toEqual([{
      name: 'dibujar_modelo', description: esperados.tool_description, strict: true, input_schema: esperados.model_schema,
    }]);
  });

  it('ejecuta la herramienta, reenvía el turno completo y devuelve el diagrama', async () => {
    const toolTurn = claudeTool(modelo.modelo);
    fetchMock.mockReturnValueOnce(ok(toolTurn)).mockReturnValueOnce(ok(claudeText('¿Qué te llevó a...?')));
    await expect(runClaude(history)).resolves.toEqual({ text: '¿Qué te llevó a...?', diagram: modelo.mermaid });

    const second = sentBodies()[1];
    expect(second.messages[1]).toEqual({ role: 'assistant', content: toolTurn.content });
    const [toolResult] = second.messages[2].content;
    expect(second.messages[2].role).toBe('user');
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1', is_error: false });
    expect(JSON.parse(toolResult.content)).toEqual({ dibujado: true, senales: modelo.senales });
  });

  it('devuelve el error al modelo si los argumentos no son válidos', async () => {
    fetchMock.mockReturnValueOnce(ok(claudeTool({ entidades: [], relaciones: [{ nombre: 'r', extremos: [], atributos: [] }] })))
      .mockReturnValueOnce(ok(claudeText('Cuéntame más.')));
    await expect(runClaude(history)).resolves.toEqual({ text: 'Cuéntame más.', diagram: null });
    const [toolResult] = sentBodies()[1].messages[2].content;
    expect(toolResult.is_error).toBe(true);
    expect(JSON.parse(toolResult.content)).toEqual({ error: "La relación 'r' debe tener 2 o 3 extremos." });
  });

  it('en la última vuelta exige texto y falla si se supera el límite', async () => {
    fetchMock.mockImplementation(() => ok(claudeTool(modelo.modelo)));
    await expect(runClaude(history)).rejects.toThrow('maximum number of iterations');
    expect(sentBodies().map((b) => b.tool_choice.type)).toEqual(['auto', 'auto', 'none']);
  });

  it('trata max_tokens como fin sin herramienta y refusal como error', async () => {
    fetchMock.mockReturnValueOnce(ok({ ...claudeTool(modelo.modelo), stop_reason: 'max_tokens' }));
    await expect(runClaude(history)).rejects.toThrow('Empty reply (stop_reason=max_tokens)');

    fetchMock.mockReturnValueOnce(ok({ ...claudeText('No.'), stop_reason: 'refusal' }));
    await expect(runClaude(history)).rejects.toThrow('declined');
  });
});

// ── OpenAI ──────────────────────────────────────────────────────────

const reasoning = { type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: 'enc', content: null };
const openaiText = (text: string) => ({
  status: 'completed',
  output: [reasoning, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] }],
});
const openaiTool = (args: string) => ({
  status: 'completed',
  output: [reasoning, { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'dibujar_modelo', arguments: args, status: 'completed' }],
});

describe('OpenAI', () => {
  it('responde con texto directo y envía los parámetros de Python', async () => {
    fetchMock.mockReturnValueOnce(ok(openaiText('Hola, pega tu enunciado.')));
    await expect(runOpenAI(history)).resolves.toEqual({ text: 'Hola, pega tu enunciado.', diagram: null });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-openai' });
    expect(sentBodies()[0]).toEqual({
      model: 'gpt-5.6-luna', instructions: esperados.system_prompt, input: history,
      tools: [{ type: 'function', name: 'dibujar_modelo', description: esperados.tool_description, strict: true,
                parameters: esperados.model_schema }],
      tool_choice: 'auto', store: false, include: ['reasoning.encrypted_content'],
    });
  });

  it('ejecuta la herramienta, reenvía los items y devuelve el diagrama', async () => {
    const toolTurn = openaiTool(JSON.stringify(modelo.modelo));
    fetchMock.mockReturnValueOnce(ok(toolTurn)).mockReturnValueOnce(ok(openaiText('¿Por qué...?')));
    await expect(runOpenAI(history)).resolves.toEqual({ text: '¿Por qué...?', diagram: modelo.mermaid });

    const input = sentBodies()[1].input;
    expect(input).toHaveLength(4);
    expect(input[1]).toEqual({ type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: 'enc' }); // sin nulos
    expect(input[2]).toEqual(toolTurn.output[1]);
    expect(input[3].type).toBe('function_call_output');
    expect(input[3].call_id).toBe('call_1');
    expect(JSON.parse(input[3].output)).toEqual({ dibujado: true, senales: modelo.senales });
  });

  it('devuelve el error al modelo si los argumentos no son válidos', async () => {
    fetchMock.mockReturnValueOnce(ok(openaiTool('{roto'))).mockReturnValueOnce(ok(openaiText('Cuéntame más.')));
    await expect(runOpenAI(history)).resolves.toEqual({ text: 'Cuéntame más.', diagram: null });
    expect(JSON.parse(sentBodies()[1].input[3].output)).toHaveProperty('error');
  });

  it('en la última vuelta exige texto y falla si se supera el límite', async () => {
    fetchMock.mockImplementation(() => ok(openaiTool(JSON.stringify(modelo.modelo))));
    await expect(runOpenAI(history)).rejects.toThrow('maximum number of iterations');
    expect(sentBodies().map((b) => b.tool_choice)).toEqual(['auto', 'auto', 'none']);
  });
});

// ── runAgent y red ──────────────────────────────────────────────────

describe('runAgent', () => {
  it('elige el proveedor', async () => {
    fetchMock.mockReturnValueOnce(ok(openaiText('A'))).mockReturnValueOnce(ok(claudeText('B')));
    expect((await runAgent('openai', history)).text).toBe('A');
    expect((await runAgent('claude', history)).text).toBe('B');
  });

  it('convierte cualquier fallo en el mensaje en español sin exponer las claves', async () => {
    fetchMock.mockReturnValue(status(401));
    await expect(runAgent('claude', history)).rejects.toThrow(TUTOR_UNAVAILABLE);
    const logged = JSON.stringify((console.warn as jest.Mock).mock.calls);
    expect(logged).not.toContain('test-anthropic');
    expect(fetchMock).toHaveBeenCalledTimes(1); // 401 no se reintenta
  });
});

describe('postJson', () => {
  it('reintenta hasta 2 veces en 429, 5xx y errores de red', async () => {
    fetchMock.mockReturnValueOnce(status(429)).mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockReturnValueOnce(ok({ fine: true }));
    await expect(postJson('https://x', {}, {})).resolves.toEqual({ fine: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('se rinde tras 3 intentos fallidos', async () => {
    fetchMock.mockImplementation(() => status(503));
    await expect(postJson('https://x', {}, {})).rejects.toThrow('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('corta una llamada colgada con AbortController', async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    await expect(postJson('https://x', {}, {}, { timeoutMs: 20, retries: 1 })).rejects.toThrow('Timeout after 20 ms');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
