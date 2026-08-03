export interface Player {
  id: string;
  name: string;
  age: string;
  gender: string;
  grade: string;
  count: number;
  status: string;
  role?: string;
}

export interface Court {
  id: string;
  title: string;
  type: string;
  order_idx: number;
  start_time?: number | null;
}