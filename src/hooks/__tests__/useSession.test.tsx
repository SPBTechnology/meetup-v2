import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getSession, onAuthStateChange } from '../../data/auth';
import { fakeSession } from '../../test-utils/supabaseFixtures';
import { SessionProvider, useSession } from '../useSession';

// jest.mock is hoisted above the imports above by babel-plugin-jest-hoist, so
// `getSession`/`onAuthStateChange` already resolve to this mock.
jest.mock('../../data/auth', () => ({
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
}));

const mockGetSession = getSession as jest.Mock;
const mockOnAuthStateChange = onAuthStateChange as jest.Mock;

describe('useSession', () => {
  afterEach(() => jest.clearAllMocks());

  it('throws when used outside a SessionProvider', async () => {
    // Suppress React's expected "error boundary" console.error for this case.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useSession())).rejects.toThrow(/SessionProvider/);
    spy.mockRestore();
  });

  it('starts loading, then resolves to null when signed out', async () => {
    mockGetSession.mockResolvedValue(null);
    mockOnAuthStateChange.mockReturnValue(jest.fn());

    const { result } = await renderHook(() => useSession(), { wrapper: SessionProvider });

    // RNTL v14's renderHook is itself async and already flushes pending
    // microtasks before resolving, so the transient loading:true instant
    // isn't reliably observable here — assert only the settled state.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it('resolves to the current session when signed in', async () => {
    const session = fakeSession();
    mockGetSession.mockResolvedValue(session);
    mockOnAuthStateChange.mockReturnValue(jest.fn());

    const { result } = await renderHook(() => useSession(), { wrapper: SessionProvider });

    await waitFor(() => expect(result.current.session).toEqual(session));
  });

  it('updates when onAuthStateChange fires (e.g. after signIn/signOut elsewhere)', async () => {
    mockGetSession.mockResolvedValue(null);
    let emit: (session: unknown) => void = () => {};
    mockOnAuthStateChange.mockImplementation((cb: (s: unknown) => void) => {
      emit = cb;
      return jest.fn();
    });

    const { result } = await renderHook(() => useSession(), { wrapper: SessionProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const session = fakeSession();
    await act(() => emit(session));
    expect(result.current.session).toEqual(session);

    await act(() => emit(null));
    expect(result.current.session).toBeNull();
  });

  it('unsubscribes on unmount', async () => {
    const unsubscribe = jest.fn();
    mockGetSession.mockResolvedValue(null);
    mockOnAuthStateChange.mockReturnValue(unsubscribe);

    const { unmount, result } = await renderHook(() => useSession(), { wrapper: SessionProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
