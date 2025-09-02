'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanPage() {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [activity, setActivity] = useState<'indoor' | 'outdoor' | 'camping'>('indoor');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ date, lat, lon, activity });
    const res = await fetch(`/api/context?${params.toString()}`);
    const ctx = await res.json();
    sessionStorage.setItem('context', JSON.stringify(ctx));
    router.push('/result');
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <h1 className="text-xl font-bold">계획</h1>
      <label className="block">
        날짜
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-1" />
      </label>
      <label className="block">
        위도
        <input type="number" value={lat} onChange={e => setLat(e.target.value)} className="border p-1" />
      </label>
      <label className="block">
        경도
        <input type="number" value={lon} onChange={e => setLon(e.target.value)} className="border p-1" />
      </label>
      <label className="block">
        활동
        <select value={activity} onChange={e => setActivity(e.target.value as any)} className="border p-1">
          <option value="indoor">실내</option>
          <option value="outdoor">실외</option>
          <option value="camping">캠핑</option>
        </select>
      </label>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">예보 가져오기</button>
    </form>
  );
}
