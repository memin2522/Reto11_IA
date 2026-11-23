# Tutor de modelado ER — app móvil

El tutor te guía con preguntas para que construyas por ti mismo un modelo Entidad-Relación (notación pie de cuervo) a partir de tu enunciado; nunca te da la solución. Es la misma lógica del tutor web (mismo prompt, misma herramienta `dibujar_modelo` y misma revisión estructural), en una app sin registro ni almacenamiento: la conversación vive solo en memoria y se borra al cerrar la app.

> Uso exclusivo para el taller de clase. Las claves de las APIs quedan dentro de la app (`EXPO_PUBLIC_*`), así que no la publiques ni compartas el paquete compilado.

## Instalación

Requisitos: Node.js 20 o superior y la app **Expo Go** en tu teléfono (Android o iOS).

```bash
cd movil
npm install
```

## Claves

Copia el archivo de ejemplo y escribe tus claves:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

Si falta una clave, ese tutor aparece deshabilitado en la pantalla de inicio. `.env` está en `.gitignore` y no se sube al repositorio. Si cambias el `.env`, reinicia Expo con `npx expo start -c`.

## Ejecutar con Expo Go

```bash
npx expo start
```

Escanea el código QR con la cámara (iOS) o con Expo Go (Android). El teléfono y el computador deben estar en la misma red; si no, usa `npx expo start --tunnel`.

## Pruebas

```bash
npm test            # port del modelo ER idéntico a Python y bucle de cada proveedor con fetch simulado
npm run typecheck
```

`src/agent/definicion.ts` y `src/agent/__tests__/esperados.json` se generan desde el código Python (`app/llm/common.py` y `app/tools/er_model.py`). Si cambias el prompt, la herramienta o `er_model.py`, regenéralos con `npm run generar` y vuelve a correr las pruebas.

## Estructura

- `src/agent/`: port a TypeScript del agente (`claude.ts`, `openai.ts`, `erModel.ts`, `common.ts`, `http.ts`). La interfaz solo usa `runAgent(provider, history)`.
- `src/config.ts`: único lugar donde se leen las claves.
- `src/screens/`: pantalla de inicio y chat.
- `src/components/`: diagrama Mermaid 11.17.2 en una WebView (vista previa y pantalla completa con zoom).
