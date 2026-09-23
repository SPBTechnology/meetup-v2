import { screen } from '@testing-library/react-native';

import RootLayout from '../../app/_layout';
import HomeScreen from '../../app/index';
import { renderRoute } from '../../test-utils/renderRoute';

describe('home route', () => {
  it('renders at /', async () => {
    const router = await renderRoute({ _layout: RootLayout, index: HomeScreen });

    expect(router.getPathname()).toBe('/');
    expect(screen.getByTestId('home-screen')).toBeOnTheScreen();
    expect(screen.getByText('MeetUp')).toBeOnTheScreen();
  });
});
