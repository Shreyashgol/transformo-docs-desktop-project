import type { TransformoApi } from '../shared/api';

declare global {
  interface Window {
    transformo: TransformoApi;
  }
}

export {};
