import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import './index.css';
import { otaUpdateService } from './services/otaUpdateService.ts';

// Notify Capgo native layer immediately upon JavaScript bundle load and execution
// MUST execute before any Supabase network requests, authentication recovery, or heavy initialization
otaUpdateService.initialize().catch((err) => {
  console.warn('[OTA] Early bootstrap initialization error:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ThemeProvider>
  </StrictMode>,
);
