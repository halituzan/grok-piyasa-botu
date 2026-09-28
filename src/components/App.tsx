'use client';

import { Providers } from '@/app/providers';
import Dashboard from './Dashboard';

export default function App() {
  return (
    <Providers>
      <Dashboard />
    </Providers>
  );
}
