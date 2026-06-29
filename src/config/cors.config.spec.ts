import {
  buildCorsOriginDelegate,
  isAllowedCorsOrigin,
  parseCorsOrigins,
} from './cors.config';

describe('CORS configuration', () => {
  it('parses configured origins and keeps default local/frontend origins', () => {
    expect(parseCorsOrigins()).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://farm-management-theta.vercel.app',
    ]);

    expect(
      parseCorsOrigins(
        'http://localhost:3000, https://farm-management-theta.vercel.app ',
      ),
    ).toEqual([
      'http://localhost:3000',
      'https://farm-management-theta.vercel.app',
    ]);
  });

  it('allows the configured production frontend and Vercel preview deployments', () => {
    const allowedOrigins = parseCorsOrigins();

    expect(
      isAllowedCorsOrigin(
        'https://farm-management-theta.vercel.app',
        allowedOrigins,
      ),
    ).toBe(true);
    expect(
      isAllowedCorsOrigin(
        'https://farm-management-jqoi1wprp-yotins-projects.vercel.app',
        allowedOrigins,
      ),
    ).toBe(true);
  });

  it('allows requests without an origin header', () => {
    expect(isAllowedCorsOrigin(undefined, parseCorsOrigins())).toBe(true);
  });

  it('rejects unrelated origins', () => {
    expect(
      isAllowedCorsOrigin('https://evil.example.com', parseCorsOrigins()),
    ).toBe(false);
  });

  it('passes allowed origins through the CORS delegate callback', () => {
    const delegate = buildCorsOriginDelegate();
    const callback = jest.fn();

    delegate(
      'https://farm-management-jqoi1wprp-yotins-projects.vercel.app',
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('returns an error for rejected origins through the CORS delegate callback', () => {
    const delegate = buildCorsOriginDelegate();
    const callback = jest.fn();

    delegate('https://evil.example.com', callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });
});
