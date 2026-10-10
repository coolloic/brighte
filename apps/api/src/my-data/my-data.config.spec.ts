import { assertMyDataAllowed, myDataEnabled } from './my-data.config.js';

describe('my data config', () => {
  it.each([
    ['on', true],
    [' ON ', true],
    ['off', false],
    ['', false],
    [undefined, false],
  ])('MY_DATA=%j is on: %s', (value, on) => {
    expect(myDataEnabled({ MY_DATA: value })).toBe(on);
  });

  it('refuses to start with it on in production', () => {
    expect(() => assertMyDataAllowed({ MY_DATA: 'on', NODE_ENV: 'production' })).toThrow(/local use only/);
    expect(() => assertMyDataAllowed({ MY_DATA: 'on', NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertMyDataAllowed({ MY_DATA: 'off', NODE_ENV: 'production' })).not.toThrow();
  });
});
