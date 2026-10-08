export type Bucket = 'save' | 'spend' | 'share';
export const BUCKETS: readonly Bucket[] = ['save', 'spend', 'share'];
export interface Split { save: number; spend: number; share: number }
