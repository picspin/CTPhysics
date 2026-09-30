import { computeDemo, type DemoParams, type DemoResult } from '@/utils/iterative-recon-demo';

export interface WorkerRequest {
  id: number;
  params: DemoParams;
}
export interface WorkerResponse {
  id: number;
  result: DemoResult;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (msg: WorkerResponse) => void;
};

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, params } = e.data;
  ctx.postMessage({ id, result: computeDemo(params) });
};

export {};
