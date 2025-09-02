import { NextRequest, NextResponse } from 'next/server';
import { findSnapshot, upsertSnapshot } from '@/lib/db';
import { getShortForecast, getMidForecast } from '@/lib/providers/kma';
import { getAirQuality } from '@/lib/providers/airkorea';
import { normalizeForecast } from '@/lib/normalize';
import { todayKST } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date')!;
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  // 1) 캐시 조회
  const cached = await findSnapshot({ date, lat, lon });
  if (cached) return NextResponse.json(cached);

  // 2) horizon 판정
  const d = Math.floor((new Date(date).getTime() - todayKST().getTime()) / 86400000);
  const horizon = d < 0 ? 'past' : d === 0 ? 'now' : d <= 3 ? 'short' : d <= 10 ? 'mid' : 'long';

  // 3) 외부 API 호출
  const wx = horizon === 'mid'
    ? await getMidForecast({ lat, lon, date })
    : await getShortForecast({ lat, lon, date });
  const aq = await getAirQuality({ lat, lon, date });

  // 4) 정규화
  const snap = normalizeForecast({ wx, aq, date, lat, lon, horizon });

  // 5) 저장 및 응답
  await upsertSnapshot(snap);
  return NextResponse.json(snap);
}
