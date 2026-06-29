import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';

const createConfig = (values: Record<string, string | undefined>) =>
  ({
    get: jest.fn((key: string, defaultValue?: string) =>
      key in values ? values[key] : defaultValue,
    ),
  }) as unknown as ConfigService;

describe('GoogleStrategy', () => {
  it('does not block application startup when Google OAuth credentials are missing', () => {
    const configService = createConfig({});

    expect(() => new GoogleStrategy(configService)).not.toThrow();
  });
});
