import { screen, waitFor } from '@testing-library/react-native';

import AppLayout from '../../app/(app)/_layout';
import HomeScreen from '../../app/(app)/index';
import AuthLayout from '../../app/(auth)/_layout';
import SignInScreen from '../../app/(auth)/sign-in';
import RootLayout from '../../app/_layout';
import { getSession } from '../../data/auth';
import { fakeSession } from '../../test-utils/supabaseFixtures';
import { renderRoute } from '../../test-utils/renderRoute';

// The full mock surface every screen under RootLayout might import from, so
// any route in ROUTES below can be rendered without touching the real client.
jest.mock('../../data/auth', () => ({
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(() => jest.fn()),
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock('../../data/conversations', () => ({
  listConversations: jest.fn(() => Promise.resolve([])),
}));

const mockGetSession = getSession as jest.Mock;

// This is the real root layout tree (down to the auth screens), proving the
// Stack.Protected wiring in src/app/_layout.tsx actually routes based on
// session state — not just that useSession() computes the right booleans.
const ROUTES = {
  _layout: RootLayout,
  '(app)/_layout': AppLayout,
  '(app)/index': HomeScreen,
  '(app)/create-group': () => null,
  '(auth)/_layout': AuthLayout,
  '(auth)/sign-in': SignInScreen,
};

describe('auth gate (root layout)', () => {
  afterEach(() => jest.clearAllMocks());

  it('redirects to sign-in when signed out', async () => {
    mockGetSession.mockResolvedValue(null);

    const router = await renderRoute(ROUTES);

    await waitFor(() => expect(screen.getByTestId('SignIn-Screen')).toBeOnTheScreen());
    expect(router.getPathname()).toBe('/sign-in');
    expect(screen.queryByTestId('Home-Screen')).not.toBeOnTheScreen();
  });

  it('shows the app when signed in', async () => {
    mockGetSession.mockResolvedValue(fakeSession());

    const router = await renderRoute(ROUTES);

    await waitFor(() => expect(screen.getByTestId('Home-Screen')).toBeOnTheScreen());
    expect(router.getPathname()).toBe('/');
    expect(screen.queryByTestId('SignIn-Screen')).not.toBeOnTheScreen();
  });
});
