// Port de app/tools/er_model.py: validación, diagrama Mermaid y revisión estructural.
// El LLM solo extrae el modelo a JSON. El dibujo y la revisión son deterministas: el mismo
// modelo siempre produce el mismo diagrama y las mismas señales que la versión en Python.

export type Minimo = 'cero' | 'uno' | 'sin_definir';
export type Maximo = 'uno' | 'muchos' | 'sin_definir';

export interface Atributo {
  nombre: string;
  es_identificador: boolean;
}
export interface Entidad {
  nombre: string;
  atributos: Atributo[];
}
export interface Extremo {
  entidad: string;
  minimo: Minimo;
  maximo: Maximo;
}
export interface Relacion {
  nombre: string;
  extremos: Extremo[];
  atributos: string[];
}
export interface ModeloER {
  entidades: Entidad[];
  relaciones: Relacion[];
}
export interface Senal {
  dimension: string;
  codigo: string;
  detalle: string;
}

const MINIMOS = ['cero', 'uno', 'sin_definir'];
const MAXIMOS = ['uno', 'muchos', 'sin_definir'];

export class InvalidModel extends Error {}

// ── Utilidades que imitan a Python ──────────────────────────────────

/** " ".join(value.split()) */
function collapse(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(' ');
}

/** value.strip().lower() */
function key(value: string): string {
  return value.trim().toLowerCase();
}

/** repr() de una cadena de Python, como lo produce !r en los f-strings. */
export function pyRepr(value: string): string {
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (ch === '\\') out += '\\\\';
    else if (ch === quote) out += '\\' + quote;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20 || (code >= 0x7f && code < 0xa0)) out += '\\x' + code.toString(16).padStart(2, '0');
    else out += ch;
  }
  return out + quote;
}

// ── Validación ──────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Forma básica que el esquema strict garantiza. En Python un argumento mal formado lanzaría
 *  KeyError; aquí se devuelve como error al modelo para que corrija los argumentos. */
function checkShape(model: unknown): asserts model is ModeloER {
  const fail = (msg: string): never => {
    throw new InvalidModel(msg);
  };
  if (!isObject(model) || !Array.isArray(model.entidades) || !Array.isArray(model.relaciones)) {
    fail('El modelo debe tener "entidades" y "relaciones".');
  }
  const m = model as Record<string, unknown[]>;
  for (const ent of m.entidades) {
    if (!isObject(ent) || typeof ent.nombre !== 'string' || !Array.isArray(ent.atributos)) {
      fail('Cada entidad debe tener "nombre" y "atributos".');
    }
    for (const attr of (ent as { atributos: unknown[] }).atributos) {
      if (!isObject(attr) || typeof attr.nombre !== 'string' || typeof attr.es_identificador !== 'boolean') {
        fail('Cada atributo debe tener "nombre" y "es_identificador".');
      }
    }
  }
  for (const rel of m.relaciones) {
    if (!isObject(rel) || typeof rel.nombre !== 'string' || !Array.isArray(rel.extremos) ||
        !Array.isArray(rel.atributos) || !rel.atributos.every((a) => typeof a === 'string')) {
      fail('Cada relación debe tener "nombre", "extremos" y "atributos".');
    }
    for (const ext of (rel as { extremos: unknown[] }).extremos) {
      if (!isObject(ext) || typeof ext.entidad !== 'string' ||
          !MINIMOS.includes(ext.minimo as string) || !MAXIMOS.includes(ext.maximo as string)) {
        fail('Cada extremo debe tener "entidad", "minimo" y "maximo" válidos.');
      }
    }
  }
}

/** Lo que el esquema strict no puede exigir. Los errores de modelado no se validan aquí: son señales. */
export function validate(model: unknown): asserts model is ModeloER {
  checkShape(model);
  for (const rel of model.relaciones) {
    if (rel.extremos.length !== 2 && rel.extremos.length !== 3) {
      throw new InvalidModel(`La relación ${pyRepr(rel.nombre)} debe tener 2 o 3 extremos.`);
    }
  }
  for (const ent of model.entidades) {
    if (!ent.nombre.trim()) throw new InvalidModel('Hay una entidad sin nombre.');
  }
}

// ── Diagrama ────────────────────────────────────────────────────────

// Símbolos de pie de cuervo según el lado: (mínimo, máximo) → marca junto a la entidad
const LEFT: Record<string, string> = { 'cero,uno': '|o', 'uno,uno': '||', 'cero,muchos': '}o', 'uno,muchos': '}|' };
const RIGHT: Record<string, string> = { 'cero,uno': 'o|', 'uno,uno': '||', 'cero,muchos': 'o{', 'uno,muchos': '|{' };

/** Texto seguro dentro de comillas de Mermaid. */
function text(value: string): string {
  return collapse(value).replace(/"/g, '#quot;');
}

/** Devuelve la marca y si hubo que suponer algún valor sin definir. */
function marker(table: Record<string, string>, extremo: Extremo): [string, boolean] {
  const minimo = extremo.minimo === 'sin_definir' ? 'cero' : extremo.minimo;
  const maximo = extremo.maximo === 'sin_definir' ? 'uno' : extremo.maximo;
  const guessed = extremo.minimo === 'sin_definir' || extremo.maximo === 'sin_definir';
  return [table[`${minimo},${maximo}`], guessed];
}

/** Los nombres de atributo en Mermaid no admiten espacios. */
function attrName(name: string): string {
  const cleaned = name.split(/\s+/).filter(Boolean).join('_');
  return Array.from(cleaned).filter((ch) => /[\p{L}\p{N}_-]/u.test(ch)).join('') || 'atributo';
}

export function toMermaid(model: ModeloER): string {
  const ids = new Map<string, string>();
  const lines = ['erDiagram'];

  const entityId = (name: string): string => {
    const k = key(name);
    if (!ids.has(k)) {
      ids.set(k, `E${ids.size + 1}`);
      lines.push(`  ${ids.get(k)}["${text(name)}"]`);
    }
    return ids.get(k)!;
  };

  for (const ent of model.entidades) {
    const eid = entityId(ent.nombre);
    if (ent.atributos.length) {
      lines.push(`  ${eid} {`);
      for (const attr of ent.atributos) {
        const pk = attr.es_identificador ? ' PK' : '';
        // Mermaid exige un tipo; en el modelo conceptual no hay tipos, así que va "_"
        lines.push(`    _ ${attrName(attr.nombre)}${pk}`);
      }
      lines.push('  }');
    }
  }

  model.relaciones.forEach((rel, i) => {
    const index = i + 1;
    let label = rel.nombre;
    if (rel.atributos.length) label += ` (${rel.atributos.join(', ')})`;

    if (rel.extremos.length === 3) {
      // Mermaid solo dibuja relaciones binarias: la ternaria se representa como entidad asociativa
      const rid = `R${index}`;
      lines.push(`  ${rid}["${text(label)}"]`);
      for (const extremo of rel.extremos) {
        lines.push(`  ${entityId(extremo.entidad)} ||--o{ ${rid} : ""`);
      }
      return;
    }

    const [a, b] = rel.extremos;
    const [left, guessedA] = marker(LEFT, a);
    const [right, guessedB] = marker(RIGHT, b);
    if (guessedA || guessedB) label += ' (?)';
    lines.push(`  ${entityId(a.entidad)} ${left}--${right} ${entityId(b.entidad)} : "${text(label)}"`);
  });

  return lines.join('\n');
}

// ── Revisión estructural ────────────────────────────────────────────

/** Señales para el agente. Nunca se muestran al estudiante. */
export function review(model: ModeloER): Senal[] {
  const signals: Senal[] = [];
  const add = (dimension: string, codigo: string, detalle: string) => signals.push({ dimension, codigo, detalle });

  // Map conserva el orden de la primera inserción y actualiza el valor, igual que un dict de Python
  const declared = new Map<string, Entidad>();
  for (const ent of model.entidades) {
    const k = key(ent.nombre);
    if (declared.has(k)) add('entidades', 'entidad_duplicada', `La entidad ${pyRepr(ent.nombre)} aparece más de una vez.`);
    declared.set(k, ent);

    if (!ent.atributos.length) {
      add('atributos', 'entidad_sin_atributos', `La entidad ${pyRepr(ent.nombre)} no tiene atributos.`);
    } else if (!ent.atributos.some((a) => a.es_identificador)) {
      add('atributos', 'entidad_sin_identificador', `La entidad ${pyRepr(ent.nombre)} no tiene identificador.`);
    }

    const names = ent.atributos.map((a) => key(a.nombre));
    const dups = [...new Set(names.filter((n) => names.indexOf(n) !== names.lastIndexOf(n)))].sort();
    for (const dup of dups) {
      add('atributos', 'atributo_duplicado', `El atributo ${pyRepr(dup)} se repite en ${pyRepr(ent.nombre)}.`);
    }
  }

  const related = new Set<string>();
  for (const rel of model.relaciones) {
    const name = pyRepr(rel.nombre);
    for (const extremo of rel.extremos) {
      const k = key(extremo.entidad);
      related.add(k);
      if (!declared.has(k)) {
        add('relaciones', 'entidad_no_declarada',
          `La relación ${name} usa la entidad ${pyRepr(extremo.entidad)}, que no está declarada.`);
      }
      if (extremo.maximo === 'sin_definir') {
        add('cardinalidad', 'cardinalidad_sin_definir',
          `En ${name} no está definida la cardinalidad del lado de ${pyRepr(extremo.entidad)}.`);
      }
      if (extremo.minimo === 'sin_definir') {
        add('participacion', 'participacion_sin_definir',
          `En ${name} no está definida la participación del lado de ${pyRepr(extremo.entidad)}.`);
      }
    }

    if (rel.extremos.length === 3) {
      add('grado', 'relacion_ternaria', `${name} es ternaria; se dibujó como entidad asociativa unida a las tres entidades.`);
      continue;
    }

    const [a, b] = rel.extremos;
    if (key(a.entidad) === key(b.entidad)) {
      add('grado', 'relacion_recursiva', `${name} es recursiva sobre ${pyRepr(a.entidad)}.`);
    }

    const maximos = new Set([a.maximo, b.maximo]);
    const attrs = rel.atributos.join(', ');
    if (rel.atributos.length && maximos.size === 1 && maximos.has('muchos')) {
      add('entidad_asociativa', 'muchos_a_muchos_con_atributos',
        `${name} es de muchos a muchos y tiene atributos propios: ${attrs}.`);
    } else if (rel.atributos.length && maximos.size === 2 && maximos.has('uno') && maximos.has('muchos')) {
      add('atributos', 'atributos_en_relacion_uno_a_muchos',
        `${name} es de uno a muchos y tiene atributos propios: ${attrs}.`);
    }
  }

  for (const [k, ent] of declared) {
    if (!related.has(k) && model.relaciones.length) {
      add('relaciones', 'entidad_aislada', `La entidad ${pyRepr(ent.nombre)} no participa en ninguna relación.`);
    }
  }

  return signals;
}
