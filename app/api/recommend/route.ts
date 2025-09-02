import { NextRequest, NextResponse } from 'next/server';
import { riskScores } from '@/lib/risk';
import { ruleCandidates, applyRules } from '@/lib/rules';
import { getProductsMeta } from '@/lib/products';

export async function POST(req: NextRequest) {
  const { profile, plan, context } = await req.json();
  const scores = riskScores(context, plan.activity);
  const cands = ruleCandidates(scores);
  const safe = applyRules(cands, profile);
  const items = await getProductsMeta(safe);
  return NextResponse.json({ risks: scores, items, warnings: [] });
}
