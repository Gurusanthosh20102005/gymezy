import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeContext';
import { ToastProvider } from './src/widgets/CustomScaffoldMessage';
import { AlertProvider } from './src/widgets/CustomAlertModal';
import { AppNavigator } from './src/navigation/AppNavigator';

import { AuthProvider } from './src/context/AuthContext';

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AlertProvider>
              <AppNavigator />
            </AlertProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
