// Comprueba que el port a TypeScript produce exactamente lo mismo que app/tools/er_model.py.
// esperados.json se genera con: python3 movil/scripts/generar_desde_python.py
import esperados from './esperados.json';
import { MODEL_SCHEMA, SYSTEM_PROMPT, TOOL_DESCRIPTION, TOOL_NAME } from '../definicion';
import { InvalidModel, ModeloER, pyRepr, review, toMermaid, validate } from '../erModel';
import { executeTool, pyJson } from '../common';

describe('definición copiada al pie de la letra', () => {
  it('prompt, herramienta y esquema son idénticos a los de Python', () => {
    expect(SYSTEM_PROMPT).toBe(esperados.system_prompt);
    expect(TOOL_NAME).toBe(esperados.tool_name);
    expect(TOOL_DESCRIPTION).toBe(esperados.tool_description);
    expect(MODEL_SCHEMA).toEqual(esperados.model_schema);
  });
});

describe.each(esperados.casos.map((c) => [c.nombre, c] as const))('modelo %s', (_nombre, caso) => {
  const modelo = caso.modelo as ModeloER;

  it('es válido', () => {
    expect(() => validate(modelo)).not.toThrow();
  });

  it('genera el mismo Mermaid que Python', () => {
    expect(toMermaid(modelo)).toBe(caso.mermaid);
  });

  it('genera las mismas señales que Python', () => {
    expect(review(modelo)).toEqual(caso.senales);
  });
});

describe.each(esperados.invalidos.map((c) => [c.nombre, c] as const))('modelo inválido %s', (_nombre, caso) => {
  it('validate lanza el mismo mensaje que Python', () => {
    expect(() => validate(caso.modelo)).toThrow(new InvalidModel(caso.error));
  });
});

describe('executeTool', () => {
  const caso = esperados.casos.find((c) => c.nombre === 'academia_completa')!;

  it('acepta argumentos como texto JSON (OpenAI) o como objeto (Claude)', () => {
    for (const args of [JSON.stringify(caso.modelo), caso.modelo]) {
      const { result, mermaid } = executeTool('dibujar_modelo', args);
      expect(result).toEqual({ dibujado: true, senales: caso.senales });
      expect(mermaid).toBe(caso.mermaid);
    }
  });

  it('devuelve un error al modelo si los argumentos no son válidos', () => {
    expect(executeTool('dibujar_modelo', '{no es json').result).toHaveProperty('error');
    expect(executeTool('dibujar_modelo', { entidades: [] }).result).toHaveProperty('error');
    expect(executeTool('dibujar_modelo', esperados.invalidos[0].modelo).result)
      .toEqual({ error: esperados.invalidos[0].error });
    expect(executeTool('otra', caso.modelo)).toEqual({ result: { error: "Unknown tool 'otra'." }, mermaid: null });
  });
});

describe('utilidades', () => {
  it('pyRepr imita repr() de Python', () => {
    expect(pyRepr('abc')).toBe("'abc'");
    expect(pyRepr("D'Art")).toBe('"D\'Art"');
    expect(pyRepr(`a'b"c`)).toBe(`'a\\'b"c'`);
    expect(pyRepr('a\\b\n')).toBe("'a\\\\b\\n'");
  });

  it('pyJson usa los separadores de json.dumps', () => {
    expect(pyJson({ dibujado: true, senales: [{ a: 'ñ' }] })).toBe('{"dibujado": true, "senales": [{"a": "ñ"}]}');
  });
});
