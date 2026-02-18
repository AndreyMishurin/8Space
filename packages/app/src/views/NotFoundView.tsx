import { ErrorScreen } from '@/components/ErrorScreen';

export function NotFoundView() {
  return <ErrorScreen code={404} showGoHome />;
}
