import { cleanupTestUsers, createTestUser } from './helpers';

afterEach(cleanupTestUsers);

describe('auth against local Supabase', () => {
  it('a created test user is signed in as themselves', async () => {
    const user = await createTestUser('auth');

    const { data, error } = await user.client.auth.getUser();

    expect(error).toBeNull();
    expect(data.user?.id).toBe(user.id);
    expect(data.user?.email).toBe(user.email);
  });

  it('two test users get distinct identities', async () => {
    const a = await createTestUser('a');
    const b = await createTestUser('b');

    expect(a.id).not.toBe(b.id);
  });
});
