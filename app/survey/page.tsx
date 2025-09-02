'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SurveyPage() {
  const router = useRouter();
  const [profile, setProfile] = useState({ ageBand: '', sex: '', pregnant: false });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('profile', JSON.stringify(profile));
    router.push('/plan');
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <h1 className="text-xl font-bold">건강 설문</h1>
      <label className="block">
        연령대
        <select
          className="border p-1 block"
          value={profile.ageBand}
          onChange={(e) => setProfile({ ...profile, ageBand: e.target.value })}
        >
          <option value="">선택</option>
          <option value="child">소아</option>
          <option value="adult">성인</option>
        </select>
      </label>
      <label className="block">
        성별
        <select
          className="border p-1 block"
          value={profile.sex}
          onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
        >
          <option value="">선택</option>
          <option value="male">남</option>
          <option value="female">여</option>
        </select>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={profile.pregnant}
          onChange={(e) => setProfile({ ...profile, pregnant: e.target.checked })}
        />
        <span>임신 중</span>
      </label>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
        저장 후 다음
      </button>
    </form>
  );
}
