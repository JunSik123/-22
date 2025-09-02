import Link from 'next/link';

export default function Home() {
  return (
    <main className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">응급 상비약 추천</h1>
      <p>날짜와 위치에 따라 필요한 상비약을 추천해줍니다.</p>
      <Link href="/plan" className="text-blue-600 underline">계획 세우기</Link>
    </main>
  );
}
