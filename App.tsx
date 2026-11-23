import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from './src/config';
import { ChatScreen } from './src/screens/ChatScreen';
import { StartScreen } from './src/screens/StartScreen';

// Sin navegación persistente ni almacenamiento: dos pantallas y todo el estado en memoria
export default function App() {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [chatting, setChatting] = useState(false);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {chatting && provider ? (
        <ChatScreen key={provider} provider={provider} onChangeTutor={() => setChatting(false)} />
      ) : (
        <StartScreen
          initial={provider}
          onStart={(p) => {
            setProvider(p);
            setChatting(true);
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
