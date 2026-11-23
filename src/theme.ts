import { useColorScheme } from 'react-native';

const light = {
  dark: false,
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1B1F24',
  muted: '#5B6470',
  border: '#D9DDE3',
  primary: '#2F5BD3',
  onPrimary: '#FFFFFF',
  studentBubble: '#2F5BD3',
  onStudentBubble: '#FFFFFF',
  tutorBubble: '#FFFFFF',
  errorBg: '#FDECEC',
  errorText: '#A3261F',
  disabled: '#AEB4BD',
};

const dark: typeof light = {
  dark: true,
  background: '#121417',
  surface: '#1C1F24',
  text: '#E8EAED',
  muted: '#A0A7B1',
  border: '#30353C',
  primary: '#7EA2FF',
  onPrimary: '#0E1630',
  studentBubble: '#3A5FC8',
  onStudentBubble: '#FFFFFF',
  tutorBubble: '#1C1F24',
  errorBg: '#3A1D1D',
  errorText: '#FFB4AB',
  disabled: '#4A5059',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
