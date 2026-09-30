import { screen, userEvent, waitFor } from '@testing-library/react-native';

import SignInScreen from '../../app/(auth)/sign-in';
import { signIn } from '../../data/auth';
import { DataError } from '../../data/errors';
import { renderRoute } from '../../test-utils/renderRoute';

jest.mock('../../data/auth', () => ({ signIn: jest.fn() }));

const mockSignIn = signIn as jest.Mock;

describe('sign-in route', () => {
  afterEach(() => jest.clearAllMocks());

  it('disables submit until both fields are filled', async () => {
    const user = userEvent.setup();
    await renderRoute({ index: SignInScreen });

    expect(screen.getByTestId('SignIn-SubmitButton')).toBeDisabled();

    await user.type(screen.getByTestId('SignIn-EmailInput'), 'a@example.test');
    expect(screen.getByTestId('SignIn-SubmitButton')).toBeDisabled();

    await user.type(screen.getByTestId('SignIn-PasswordInput'), 'Password1!');
    expect(screen.getByTestId('SignIn-SubmitButton')).toBeEnabled();
  });

  it('calls signIn with the trimmed email and the password on submit', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderRoute({ index: SignInScreen });

    await user.type(screen.getByTestId('SignIn-EmailInput'), '  a@example.test  ');
    await user.type(screen.getByTestId('SignIn-PasswordInput'), 'Password1!');
    await user.press(screen.getByTestId('SignIn-SubmitButton'));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('a@example.test', 'Password1!'));
  });

  it('shows a mapped error message on failure and leaves the form usable', async () => {
    mockSignIn.mockRejectedValue(new DataError('invalid_credentials'));
    const user = userEvent.setup();
    await renderRoute({ index: SignInScreen });

    await user.type(screen.getByTestId('SignIn-EmailInput'), 'a@example.test');
    await user.type(screen.getByTestId('SignIn-PasswordInput'), 'wrong');
    await user.press(screen.getByTestId('SignIn-SubmitButton'));

    await waitFor(() => expect(screen.getByTestId('SignIn-ErrorText')).toBeOnTheScreen());
    expect(screen.getByText('Incorrect email or password.')).toBeOnTheScreen();
    expect(screen.getByTestId('SignIn-SubmitButton')).toBeEnabled();
  });

  it('renders a link to sign-up', async () => {
    await renderRoute({ index: SignInScreen });
    expect(screen.getByTestId('SignIn-SignUpLink')).toBeOnTheScreen();
  });
});
