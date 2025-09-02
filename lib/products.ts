export interface Product {
  id: string;
  name: string;
  description?: string;
}

export async function getProductsMeta(ids: string[]): Promise<Product[]> {
  // e약은요 API 등을 통해 제품 메타데이터를 조회해야 합니다.
  // api가 필요합니다
  return ids.map(id => ({ id, name: id }));
}
