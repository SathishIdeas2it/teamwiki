import { resetDatabase } from '@/tests/integration/helpers/db';

beforeEach(async () => {
  await resetDatabase();
});
