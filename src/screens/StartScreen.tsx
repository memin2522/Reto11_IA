import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAvailable, Provider, PROVIDER_NAMES } from '../config';
import { useTheme } from '../theme';

const PROVIDERS: Provider[] = ['claude', 'openai'];

export function StartScreen({ initial, onStart }: { initial: Provider | null; onStart: (p: Provider) => void }) {
  const theme = useTheme();
  const firstAvailable = PROVIDERS.find(isAvailable) ?? null;
  const [selected, setSelected] = useState<Provider | null>(
    initial && isAvailable(initial) ? initial : firstAvailable,
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">Tutor de modelado ER</Text>
        <Text style={[styles.body, { color: theme.text }]}>
          Te guío con preguntas para que construyas tu modelo Entidad-Relación a partir de tu enunciado; no te doy la
          solución.
        </Text>
        <Text style={[styles.note, { color: theme.muted }]}>
          La conversación no se guarda: se borra al cerrar la app o al empezar una nueva.
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Elige con qué tutor quieres conversar</Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {PROVIDERS.map((p) => {
            const available = isAvailable(p);
            const active = selected === p;
            return (
              <Pressable
                key={p}
                disabled={!available}
                onPress={() => setSelected(p)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active, disabled: !available }}
                accessibilityLabel={available ? `Tutor ${PROVIDER_NAMES[p]}` : `Tutor ${PROVIDER_NAMES[p]}, no disponible`}
                style={[
                  styles.option,
                  { borderColor: active ? theme.primary : theme.border, backgroundColor: theme.surface },
                  active && { borderWidth: 2 },
                  !available && { opacity: 0.5 },
                ]}
              >
                <Text style={[styles.optionTitle, { color: theme.text }]}>{PROVIDER_NAMES[p]}</Text>
                {!available && (
                  <Text style={[styles.optionNote, { color: theme.muted }]}>No disponible: falta su clave en el archivo .env</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={!selected}
          onPress={() => selected && onStart(selected)}
          accessibilityRole="button"
          accessibilityLabel="Empezar la conversación"
          accessibilityState={{ disabled: !selected }}
          style={[styles.button, { backgroundColor: selected ? theme.primary : theme.disabled }]}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Empezar</Text>
        </Pressable>
        {!firstAvailable && (
          <Text style={[styles.note, { color: theme.errorText }]}>
            No hay ningún tutor disponible. Agrega al menos una clave en movil/.env y reinicia la app.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 24 },
  note: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  options: { gap: 10 },
  option: { borderWidth: 1, borderRadius: 12, padding: 16 },
  optionTitle: { fontSize: 17, fontWeight: '600' },
  optionNote: { fontSize: 13, marginTop: 4 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 17, fontWeight: '700' },
});
