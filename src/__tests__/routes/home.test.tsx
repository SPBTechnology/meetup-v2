import { screen } from '@testing-library/react-native';

import HomeScreen from '../../app/(app)/index';
import { renderRoute } from '../../test-utils/renderRoute';

describe('home route', () => {
  it('renders at /', async () => {
    const router = await renderRoute({ index: HomeScreen });

    expect(router.getPathname()).toBe('/');
    expect(screen.getByTestId('Home-Screen')).toBeOnTheScreen();
    expect(screen.getByText('MeetUp')).toBeOnTheScreen();
  });
});
