'use client';
import { useEffect, useState } from 'react';

export default function ResultPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const profile = JSON.parse(localStorage.getItem('profile') || '{}');
    const context = JSON.parse(sessionStorage.getItem('context') || '{}');
    async function run() {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, plan: { activity: context.activity || 'indoor' }, context })
      });
      const json = await res.json();
      setData(json);
    }
    run();
  }, []);

  if (!data) return <p className="p-4">로딩중...</p>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">추천 결과</h1>
      <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
