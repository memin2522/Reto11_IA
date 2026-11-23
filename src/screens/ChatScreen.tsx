import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runAgent } from '../agent';
import { DiagramPreview } from '../components/DiagramPreview';
import { Provider, PROVIDER_NAMES } from '../config';
import { ChatItem, newId, toHistory, withoutErrors } from '../conversation';
import { useTheme } from '../theme';

const SLOW_REPLY_MS = 20000;

interface Props {
  provider: Provider;
  onChangeTutor: () => void;
}

export function ChatScreen({ provider, onChangeTutor }: Props) {
  const theme = useTheme();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [slow, setSlow] = useState(false);
  const listRef = useRef<FlatList<ChatItem>>(null);
  // Cada conversación tiene un número: una respuesta que llega tarde a una conversación ya borrada se descarta
  const conversation = useRef(0);

  useEffect(() => {
    if (!waiting) return;
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_REPLY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const ask = useCallback(async (base: ChatItem[]) => {
    const current = conversation.current;
    setItems(base);
    setWaiting(true);
    try {
      const reply = await runAgent(provider, toHistory(base));
      if (conversation.current !== current) return;
      setItems([...base, { id: newId(), kind: 'tutor', text: reply.text, diagram: reply.diagram }]);
    } catch (e) {
      if (conversation.current !== current) return;
      setItems([...base, { id: newId(), kind: 'error', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      if (conversation.current === current) setWaiting(false);
    }
  }, [provider]);

  const send = () => {
    const text = draft.trim();
    if (!text || waiting) return;
    setDraft('');
    ask([...withoutErrors(items), { id: newId(), kind: 'student', text }]);
  };

  // Reenvía el mismo historial: el mensaje del estudiante ya está en él, no se duplica
  const retry = () => {
    if (!waiting) ask(withoutErrors(items));
  };

  const confirm = (title: string, message: string, action: string, onConfirm: () => void) => {
    if (items.length === 0 && !draft.trim()) return onConfirm();
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: action, style: 'destructive', onPress: onConfirm },
    ]);
  };

  const reset = () => {
    conversation.current++;
    setItems([]);
    setDraft('');
    setWaiting(false);
  };

  const newConversation = () =>
    confirm('¿Empezar una conversación nueva?', 'Se borrará esta conversación y no podrás recuperarla.', 'Borrar y empezar', reset);

  const changeTutor = () =>
    confirm('¿Cambiar de tutor?', 'Cambiar de tutor inicia una conversación nueva y se borrará esta.', 'Cambiar', () => {
      reset();
      onChangeTutor();
    });

  const scrollToEnd = () => listRef.current?.scrollToEnd({ animated: true });

  const renderItem = ({ item, index }: { item: ChatItem; index: number }) => {
    if (item.kind === 'student') {
      return (
        <View style={[styles.bubble, styles.student, { backgroundColor: theme.studentBubble }]}>
          <Text selectable style={[styles.text, { color: theme.onStudentBubble }]}>{item.text}</Text>
        </View>
      );
    }
    if (item.kind === 'tutor') {
      return (
        <View style={styles.tutorBlock}>
          <View style={[styles.bubble, styles.tutor, { backgroundColor: theme.tutorBubble, borderColor: theme.border }]}>
            {/* Texto plano: el tutor no usa markdown y aquí no se interpreta */}
            <Text selectable style={[styles.text, { color: theme.text }]}>{item.text}</Text>
          </View>
          {item.diagram && <DiagramPreview source={item.diagram} />}
        </View>
      );
    }
    const isLast = index === items.length - 1;
    return (
      <View style={[styles.bubble, styles.tutor, { backgroundColor: theme.errorBg }]} accessibilityRole="alert">
        <Text style={[styles.text, { color: theme.errorText }]}>{item.text}</Text>
        {isLast && (
          <Pressable
            onPress={retry}
            disabled={waiting}
            accessibilityRole="button"
            accessibilityLabel="Reintentar enviar tu mensaje"
            style={[styles.retry, { borderColor: theme.errorText }]}
          >
            <Text style={{ color: theme.errorText, fontWeight: '700' }}>Reintentar</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const canSend = draft.trim().length > 0 && !waiting;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Pressable
          onPress={changeTutor}
          accessibilityRole="button"
          accessibilityLabel={`Tutor ${PROVIDER_NAMES[provider]}. Cambiar de tutor`}
          hitSlop={8}
          style={styles.headerLeft}
        >
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            Tutor: {PROVIDER_NAMES[provider]}
          </Text>
          <Text style={[styles.headerSub, { color: theme.primary }]}>Cambiar tutor</Text>
        </Pressable>
        <Pressable
          onPress={newConversation}
          accessibilityRole="button"
          accessibilityLabel="Nueva conversación"
          hitSlop={8}
        >
          <Text style={[styles.headerAction, { color: theme.primary }]}>Nueva conversación</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Conversación nueva</Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                Pega el enunciado de tu ejercicio y cuéntale al tutor en qué parte del modelo estás trabajando.
              </Text>
            </View>
          }
          ListFooterComponent={
            waiting ? (
              <View style={[styles.bubble, styles.tutor, styles.typing, { backgroundColor: theme.tutorBubble, borderColor: theme.border }]}
                accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={theme.muted} />
                <Text style={[styles.text, { color: theme.muted, flexShrink: 1 }]}>
                  {slow ? 'La respuesta está tardando más de lo habitual, sigue esperando…' : 'El tutor está escribiendo…'}
                </Text>
              </View>
            ) : undefined
          }
        />

        <View style={[styles.composer, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribe o pega tu mensaje…"
            placeholderTextColor={theme.muted}
            multiline
            textAlignVertical="top"
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            accessibilityLabel="Tu mensaje para el tutor"
          />
          <Pressable
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            accessibilityState={{ disabled: !canSend, busy: waiting }}
            style={[styles.send, { backgroundColor: canSend ? theme.primary : theme.disabled }]}
          >
            <Text style={[styles.sendText, { color: theme.onPrimary }]}>Enviar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexShrink: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 13 },
  headerAction: { fontSize: 15, fontWeight: '600' },
  list: { padding: 12, gap: 10, flexGrow: 1 },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  student: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  tutor: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  tutorBlock: { gap: 4 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 16, lineHeight: 22 },
  retry: { alignSelf: 'flex-start', marginTop: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  empty: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minHeight: 44, maxHeight: 160, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  send: { borderRadius: 12, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  sendText: { fontSize: 16, fontWeight: '700' },
});
