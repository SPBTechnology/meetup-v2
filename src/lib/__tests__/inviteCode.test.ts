import { formatInviteCode } from '../inviteCode';

describe('formatInviteCode', () => {
  it('splits an 8-character code into two groups of four', () => {
    expect(formatInviteCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });

  it('leaves a non-8-character string unchanged', () => {
    expect(formatInviteCode('ABC')).toBe('ABC');
  });
});
