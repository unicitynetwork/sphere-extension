import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExtensionSphereProvider } from '../SphereProvider';
import { PopupApp } from './PopupApp';
import { getErrorMessage } from '@/sdk/errors';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      onError: (err) => {
        console.error('[Mutation error]', getErrorMessage(err));
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ExtensionSphereProvider>
        <PopupApp />
      </ExtensionSphereProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
