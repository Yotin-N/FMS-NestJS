import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthGuard } from './google-auth.guard';

const createConfig = (values: Record<string, string | undefined>) =>
  ({
    get: jest.fn((key: string, defaultValue?: string) =>
      key in values ? values[key] : defaultValue,
    ),
  }) as unknown as ConfigService;

describe('GoogleAuthGuard', () => {
  it('rejects Google OAuth requests when credentials are not configured', () => {
    const configService = createConfig({});
    const guard = new GoogleAuthGuard(configService);
    const context = {} as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(
      ServiceUnavailableException,
    );
  });
});
