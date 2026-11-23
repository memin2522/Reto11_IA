"""Genera, a partir del código Python del tutor, los archivos que la app móvil necesita al pie de la letra.

- src/agent/definicion.ts: SYSTEM_PROMPT, TOOL_NAME, TOOL_DESCRIPTION y MODEL_SCHEMA copiados sin cambios.
- src/agent/__tests__/esperados.json: Mermaid y señales que produce er_model.py para varios modelos de
  ejemplo, más el prompt y el esquema, para que las pruebas de Jest comprueben que el port es idéntico.

Uso (desde la raíz del repositorio): python3 movil/scripts/generar_desde_python.py
No importa app.llm.common (depende de asyncpg): lee sus constantes con ast.
"""
import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from app.tools import er_model  # noqa: E402  (er_model no tiene dependencias externas)

MOVIL = ROOT / "movil"


def common_constants() -> dict:
    tree = ast.parse((ROOT / "app/llm/common.py").read_text(encoding="utf-8"))
    wanted = {"SYSTEM_PROMPT", "TOOL_NAME", "TOOL_DESCRIPTION", "MAX_ITERATIONS", "REQUEST_TIMEOUT_S", "MAX_RETRIES"}
    found = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id in wanted:
            found[node.targets[0].id] = ast.literal_eval(node.value)
    missing = wanted - found.keys()
    if missing:
        raise SystemExit(f"Faltan constantes en common.py: {missing}")
    return found


def template_literal(text: str) -> str:
    return "`" + text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`"


def attr(nombre, pk=False):
    return {"nombre": nombre, "es_identificador": pk}


def ext(entidad, minimo, maximo):
    return {"entidad": entidad, "minimo": minimo, "maximo": maximo}


def ent(nombre, *atributos):
    return {"nombre": nombre, "atributos": list(atributos)}


def rel(nombre, extremos, atributos=()):
    return {"nombre": nombre, "extremos": extremos, "atributos": list(atributos)}


# Modelos de ejemplo que recorren todas las ramas de to_mermaid, review y validate
MODELOS = {
    "vacio": {"entidades": [], "relaciones": []},
    "solo_entidades": {"entidades": [ent("Cliente", attr("id", True)), ent("Pedido")], "relaciones": []},
    "academia_completa": {
        "entidades": [
            ent("Estudiante", attr("documento", True), attr("nombre"), attr("correo")),
            ent("Curso", attr("código", True), attr("nombre"), attr("nivel")),
            ent("Profesor", attr("documento", True), attr("nombre")),
        ],
        "relaciones": [
            rel("se inscribe", [ext("Estudiante", "cero", "muchos"), ext("Curso", "uno", "muchos")],
                ["fecha", "nota final"]),
            rel("dicta", [ext("Profesor", "uno", "uno"), ext("Curso", "cero", "muchos")]),
        ],
    },
    "todas_las_marcas": {
        "entidades": [ent("A", attr("a", True)), ent("B", attr("b", True))],
        "relaciones": [
            rel("r1", [ext("A", "cero", "uno"), ext("B", "cero", "uno")]),
            rel("r2", [ext("A", "uno", "uno"), ext("B", "uno", "uno")]),
            rel("r3", [ext("A", "cero", "muchos"), ext("B", "cero", "muchos")]),
            rel("r4", [ext("A", "uno", "muchos"), ext("B", "uno", "muchos")], ["x"]),
        ],
    },
    "sin_definir": {
        "entidades": [ent("Profesor", attr("nombre")), ent("Curso", attr("código", True))],
        "relaciones": [
            rel("dicta", [ext("Profesor", "sin_definir", "uno"), ext("Curso", "cero", "sin_definir")]),
            rel("coordina", [ext("Profesor", "sin_definir", "sin_definir"), ext("Curso", "uno", "muchos")],
                ["desde"]),
        ],
    },
    "ternaria_y_recursiva": {
        "entidades": [
            ent("Empleado", attr("cédula", True), attr("nombre")),
            ent("Proyecto", attr("código", True)),
            ent("Rol", attr("nombre")),
        ],
        "relaciones": [
            rel("asignación", [ext("Empleado", "cero", "muchos"), ext("Proyecto", "uno", "muchos"),
                               ext("Rol", "sin_definir", "uno")], ["horas"]),
            rel("supervisa", [ext("Empleado", "cero", "uno"), ext("empleado ", "cero", "muchos")]),
        ],
    },
    "errores_estructurales": {
        "entidades": [
            ent("Cliente", attr("nombre"), attr("Nombre "), attr("correo"), attr("correo")),
            ent(" cliente", attr("id", True)),
            ent("Color"),
            ent("Aislada", attr("id", True)),
        ],
        "relaciones": [
            rel("compra", [ext("Cliente", "uno", "muchos"), ext("Producto", "cero", "muchos")]),
            rel("pinta", [ext("Color", "cero", "uno"), ext("Cliente", "cero", "muchos")], ["fecha"]),
        ],
    },
    "nombres_raros": {
        "entidades": [
            ent('Socio "VIP"', attr("fecha de  nacimiento", True), attr("año/mes"), attr("¿?"),
                attr("número_2-b"), attr("   ")),
            ent("Libro\tde\nla  biblioteca", attr("ISBN", True)),
            ent("D'Artagnan", attr("id", True)),
        ],
        "relaciones": [
            rel('presta "libro"', [ext('Socio "VIP"', "cero", "muchos"),
                                   ext("libro de la biblioteca", "uno", "muchos")], ["fecha", 'nota "x"']),
            rel("conoce a D'Artagnan", [ext("D'Artagnan", "cero", "uno"), ext('Socio "VIP"', "cero", "uno")]),
            rel("tri\\ple", [ext("D'Artagnan", "uno", "uno"), ext("Fantasma", "cero", "uno"),
                             ext("Libro de la biblioteca", "uno", "muchos")]),
        ],
    },
}

# Modelos que validate() debe rechazar (el esquema strict sí los permite)
INVALIDOS = {
    "un_extremo": {"entidades": [ent("A")], "relaciones": [rel("r", [ext("A", "uno", "uno")])]},
    "cuatro_extremos": {
        "entidades": [ent("A")],
        "relaciones": [rel("D'r", [ext("A", "uno", "uno")] * 4)],
    },
    "entidad_sin_nombre": {"entidades": [ent("  ")], "relaciones": []},
}


def main():
    consts = common_constants()
    schema = json.dumps(er_model.MODEL_SCHEMA, ensure_ascii=False, indent=2)
    definicion = f"""// ARCHIVO GENERADO por movil/scripts/generar_desde_python.py: no lo edites a mano.
// Copia literal de SYSTEM_PROMPT, TOOL_NAME y TOOL_DESCRIPTION (app/llm/common.py)
// y de MODEL_SCHEMA (app/tools/er_model.py).

export const SYSTEM_PROMPT = {template_literal(consts["SYSTEM_PROMPT"])};

export const TOOL_NAME = {json.dumps(consts["TOOL_NAME"], ensure_ascii=False)};

export const TOOL_DESCRIPTION = {json.dumps(consts["TOOL_DESCRIPTION"], ensure_ascii=False)};

export const MAX_ITERATIONS = {consts["MAX_ITERATIONS"]};
export const REQUEST_TIMEOUT_S = {consts["REQUEST_TIMEOUT_S"]};
export const MAX_RETRIES = {consts["MAX_RETRIES"]};

export const MODEL_SCHEMA = {schema} as const;
"""
    (MOVIL / "src/agent/definicion.ts").write_text(definicion, encoding="utf-8")

    casos = []
    for nombre, modelo in MODELOS.items():
        er_model.validate(modelo)
        casos.append({"nombre": nombre, "modelo": modelo, "mermaid": er_model.to_mermaid(modelo),
                      "senales": er_model.review(modelo)})
    invalidos = []
    for nombre, modelo in INVALIDOS.items():
        try:
            er_model.validate(modelo)
        except er_model.InvalidModel as e:
            invalidos.append({"nombre": nombre, "modelo": modelo, "error": str(e)})
        else:
            raise SystemExit(f"{nombre} debía ser inválido")

    esperados = {"system_prompt": consts["SYSTEM_PROMPT"], "tool_name": consts["TOOL_NAME"],
                 "tool_description": consts["TOOL_DESCRIPTION"], "model_schema": er_model.MODEL_SCHEMA,
                 "casos": casos, "invalidos": invalidos}
    (MOVIL / "src/agent/__tests__/esperados.json").write_text(
        json.dumps(esperados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generados definicion.ts y esperados.json ({len(casos)} modelos, {len(invalidos)} inválidos).")


if __name__ == "__main__":
    main()
