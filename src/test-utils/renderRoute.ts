import { renderRouter } from 'expo-router/testing-library';

type RouterContext = Parameters<typeof renderRouter>[0];
type RouterOptions = Parameters<typeof renderRouter>[1];

/**
 * Render routes with expo-router's test harness under RNTL v14.
 *
 * Workaround: expo-router 57's `renderRouter` attaches getPathname() etc. to
 * the value returned by RNTL's `render`. In RNTL v14 `render` is async, so
 * those helpers land on the Promise and are lost once it is awaited (and the
 * `toHavePathname` matcher breaks). We await the render, then expose the
 * helpers from the original object. Remove once expo-router supports RNTL v14.
 */
export async function renderRoute(context: RouterContext, options?: RouterOptions) {
  const pending = renderRouter(context, options);
  await pending;
  return {
    getPathname: () => pending.getPathname(),
    getSegments: () => pending.getSegments(),
    getSearchParams: () => pending.getSearchParams(),
    getPathnameWithParams: () => pending.getPathnameWithParams(),
  };
}
