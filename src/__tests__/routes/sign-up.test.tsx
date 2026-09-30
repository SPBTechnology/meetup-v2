import { screen, userEvent, waitFor } from '@testing-library/react-native';

import SignUpScreen from '../../app/(auth)/sign-up';
import { signUp } from '../../data/auth';
import { DataError } from '../../data/errors';
import { renderRoute } from '../../test-utils/renderRoute';

jest.mock('../../data/auth', () => ({ signUp: jest.fn() }));

const mockSignUp = signUp as jest.Mock;

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await renderRoute({ index: SignUpScreen });
  await user.type(screen.getByTestId('SignUp-EmailInput'), email);
  await user.type(screen.getByTestId('SignUp-PasswordInput'), password);
  await user.press(screen.getByTestId('SignUp-SubmitButton'));
}

describe('sign-up route', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls signUp with the trimmed email and the password on submit', async () => {
    mockSignUp.mockResolvedValue({ userId: 'user-1', signedIn: true });

    await fillAndSubmit('  a@example.test  ', 'Password1!');

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith('a@example.test', 'Password1!'));
  });

  it('stays on the form (relying on the auth gate) when a session comes back immediately', async () => {
    mockSignUp.mockResolvedValue({ userId: 'user-1', signedIn: true });

    await fillAndSubmit('a@example.test', 'Password1!');

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(screen.queryByTestId('SignUp-ConfirmEmailText')).not.toBeOnTheScreen();
  });

  it('shows a confirmation message when the account needs email confirmation', async () => {
    mockSignUp.mockResolvedValue({ userId: 'user-1', signedIn: false });

    await fillAndSubmit('a@example.test', 'Password1!');

    await waitFor(() => expect(screen.getByTestId('SignUp-ConfirmEmailText')).toBeOnTheScreen());
    expect(screen.getByText(/a@example\.test/)).toBeOnTheScreen();
    expect(screen.getByTestId('SignUp-BackToSignInLink')).toBeOnTheScreen();
  });

  it('shows a mapped error message on failure', async () => {
    mockSignUp.mockRejectedValue(new DataError('email_already_registered'));

    await fillAndSubmit('a@example.test', 'Password1!');

    await waitFor(() => expect(screen.getByTestId('SignUp-ErrorText')).toBeOnTheScreen());
    expect(screen.getByText(/already exists/)).toBeOnTheScreen();
  });

  it('renders a link to sign-in', async () => {
    await renderRoute({ index: SignUpScreen });
    expect(screen.getByTestId('SignUp-SignInLink')).toBeOnTheScreen();
  });
});
