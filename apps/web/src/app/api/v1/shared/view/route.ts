import { sharedApi } from '@/server/shared-api';
export function POST(request: Request) {
  return sharedApi(request);
}
