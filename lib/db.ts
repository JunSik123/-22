import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function findSnapshot(params: { date: string; lat: number; lon: number; }) {
  // DB 조회 로직
  // api가 필요합니다
  return null;
}

export async function upsertSnapshot(data: any) {
  // DB 업서트 로직
  // api가 필요합니다
}
