import { StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from '@/context/AuthContext';
import { ReferenceDataProvider } from '@/context/ReferenceDataContext';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ReferenceDataProvider>
        <App />
      </ReferenceDataProvider>
    </AuthProvider>
  </StrictMode>,
);
