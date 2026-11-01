import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './app/i18n';
import { queryClient } from './app/query-client';
import { router } from './app/router';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root element is missing in index.html');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
