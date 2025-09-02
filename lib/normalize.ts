export function normalizeForecast({ wx, aq, date, lat, lon, horizon }: any) {
  // 외부 API 응답을 EnvSnapshot 구조로 정규화해야 합니다.
  // api가 필요합니다
  return {
    id: undefined,
    region: '',
    date,
    lat,
    lon,
    horizon,
    ...wx,
    ...aq,
  };
}
