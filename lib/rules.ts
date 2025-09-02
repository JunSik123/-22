import { Profile } from './types';

export function ruleCandidates(r: Record<string, number>) {
  return [
    ...(r.heat > 0.6 ? ['ORS', '쿨링겔', 'SPF50+'] : []),
    ...(r.cold > 0.6 ? ['아세트아미노펜', '기침시럽', '목캔디', '핫팩'] : []),
    ...(r.dust > 0.6 ? ['KF94마스크', '식염수 스프레이', '인공눈물'] : []),
    ...(r.gastro > 0.6 ? ['로페라마이드', 'ORS', '손소독제'] : []),
  ];
}

export function applyRules(cands: string[], profile: Profile) {
  // 상세 규칙은 도메인 지식 및 API 메타데이터에 기반해 구현해야 합니다.
  // api가 필요합니다
  return cands;
}
