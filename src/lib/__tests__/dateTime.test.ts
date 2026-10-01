import { combineDateAndTime } from '../dateTime';

describe('combineDateAndTime', () => {
  it('takes the day from the date and the time-of-day from the time', () => {
    const date = new Date(2027, 5, 1); // June 1, 2027, local midnight
    const time = new Date(2000, 0, 1, 15, 30); // 15:30, an unrelated day

    const combined = combineDateAndTime(date, time);

    expect(combined.getFullYear()).toBe(2027);
    expect(combined.getMonth()).toBe(5);
    expect(combined.getDate()).toBe(1);
    expect(combined.getHours()).toBe(15);
    expect(combined.getMinutes()).toBe(30);
  });

  it('zeroes seconds and milliseconds', () => {
    const date = new Date(2027, 5, 1, 0, 0, 45, 500);
    const time = new Date(2000, 0, 1, 9, 15, 59, 999);

    const combined = combineDateAndTime(date, time);

    expect(combined.getSeconds()).toBe(0);
    expect(combined.getMilliseconds()).toBe(0);
  });

  it('does not mutate either input', () => {
    const date = new Date(2027, 5, 1);
    const time = new Date(2000, 0, 1, 15, 30);
    const dateBefore = date.getTime();
    const timeBefore = time.getTime();

    combineDateAndTime(date, time);

    expect(date.getTime()).toBe(dateBefore);
    expect(time.getTime()).toBe(timeBefore);
  });
});
