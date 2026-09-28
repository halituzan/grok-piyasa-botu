'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-slate-400">
      Yükleniyor…
    </div>
  ),
});

export default function Page() {
  return <App />;
}
