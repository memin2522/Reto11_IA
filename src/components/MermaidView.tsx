// Dibuja un diagrama Mermaid dentro de una WebView, con la misma versión y configuración que la web.
// El código Mermaid nunca se concatena en el HTML: entra como JSON.stringify antes de cargar la página.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../theme';

const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js';
const LOAD_TIMEOUT_MS = 20000;

// HTML fijo: no lleva ningún dato del estudiante ni del modelo
export const HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=0.25, maximum-scale=6, user-scalable=yes">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #out { padding: 8px; }
  body.fit #out svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  body.full #out { display: inline-block; padding: 16px; }
</style>
</head>
<body>
<div id="out"></div>
<script>
  function report(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  function fail() { report({ ok: false }); }
  window.addEventListener('error', fail);
</script>
<script src="${MERMAID_URL}" onerror="fail()"></script>
<script>
  (async function () {
    try {
      var cfg = window.__DIAGRAMA__;
      document.body.className = cfg.full ? 'full' : 'fit';
      document.documentElement.style.background = cfg.background;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: cfg.dark ? 'dark' : 'default',
        er: { useMaxWidth: !cfg.full }
      });
      var result = await mermaid.render('diagrama', cfg.source);
      var out = document.getElementById('out');
      out.innerHTML = result.svg;
      requestAnimationFrame(function () {
        report({ ok: true, height: Math.ceil(out.getBoundingClientRect().height) });
      });
    } catch (e) {
      fail();
    }
  })();
</script>
</body>
</html>`;

interface Props {
  source: string;
  /** true: tamaño natural con zoom y desplazamiento; false: ajustado al ancho (vista previa). */
  full?: boolean;
  maxHeight?: number;
}

export function MermaidView({ source, full = false, maxHeight = 280 }: Props) {
  const theme = useTheme();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [height, setHeight] = useState(160);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const injected = useMemo(
    () => `window.__DIAGRAMA__ = ${JSON.stringify({ source, dark: theme.dark, full, background: full ? theme.background : theme.surface })}; true;`,
    [source, theme.dark, theme.background, theme.surface, full],
  );

  useEffect(() => {
    setState('loading');
    // Sin conexión, el script de Mermaid puede no responder nunca
    timer.current = setTimeout(() => setState((s) => (s === 'loading' ? 'error' : s)), LOAD_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [injected]);

  const onMessage = (event: WebViewMessageEvent) => {
    let data: { ok?: boolean; height?: number };
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    if (data.ok) {
      if (data.height) setHeight(data.height);
      setState('ok');
    } else {
      setState('error');
    }
  };

  if (state === 'error') {
    return (
      <View style={[styles.message, { borderColor: theme.border }]}>
        <Text style={{ color: theme.muted }}>No se pudo dibujar el diagrama.</Text>
      </View>
    );
  }

  return (
    <View style={full ? styles.full : { height: Math.min(height, maxHeight) }}>
      <WebView
        key={injected}
        originWhitelist={['*']}
        source={{ html: HTML }}
        injectedJavaScriptBeforeContentLoaded={injected}
        onMessage={onMessage}
        onError={() => setState('error')}
        onHttpError={() => setState('error')}
        // La página no puede navegar a ningún otro sitio
        onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith('data:')}
        setSupportMultipleWindows={false}
        style={[styles.webview, { opacity: state === 'ok' ? 1 : 0 }]}
        scrollEnabled={full}
        setBuiltInZoomControls={full}
        setDisplayZoomControls={false}
        scalesPageToFit={full}
        bounces={full}
        showsHorizontalScrollIndicator={full}
        showsVerticalScrollIndicator={full}
        accessible
        accessibilityLabel="Diagrama de tu modelo"
      />
      {state === 'loading' && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={theme.primary} />
          <Text style={{ color: theme.muted, marginTop: 6 }}>Dibujando tu modelo…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: 'transparent' },
  full: { flex: 1 },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  message: { padding: 16, borderWidth: 1, borderRadius: 12, alignItems: 'center' },
});
