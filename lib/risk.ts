const s = (x: number) => 1 / (1 + Math.exp(-x));

export interface Context {
  tAvg?: number;
  tMax?: number;
  humidity?: number;
  rainProb?: number;
  pm25?: number;
  uvIndex?: number;
}

export type Activity = 'indoor' | 'outdoor' | 'camping';

export function riskScores(ctx: Context, activity: Activity) {
  const heat = s(0.08 * ((ctx.tMax ?? 0) - 27) + 0.03 * ((ctx.humidity ?? 0) - 60) + (activity !== 'indoor' ? 0.04 : 0));
  const cold = s(0.10 * (18 - (ctx.tAvg ?? 18)));
  const dust = s(0.06 * (((ctx.pm25 ?? 20) - 35)));
  const gastro = s(0.04 * ((ctx.rainProb ?? 0)) + 0.03 * ((ctx.tAvg ?? 0) - 22));
  const uv = s(0.09 * (((ctx.uvIndex ?? 0) - 6)));
  return { heat, cold, dust, gastro, uv };
}
