export interface Profile {
  id?: string;
  ageBand?: string;
  sex?: string;
  pregnant?: boolean;
  allergies?: string[];
  chronic?: string[];
  meds?: string[];
}

export interface EnvSnapshot {
  id?: string;
  region: string;
  date: string;
  horizon: string;
  tAvg?: number;
  tMax?: number;
  tMin?: number;
  rainProb?: number;
  uvIndex?: number;
  pm25?: number;
  humidity?: number;
  windMs?: number;
  lat: number;
  lon: number;
}
