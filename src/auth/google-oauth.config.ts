import { ConfigService } from '@nestjs/config';

const DISABLED_GOOGLE_CLIENT_ID = 'google-oauth-disabled-client-id';
const DISABLED_GOOGLE_CLIENT_SECRET = 'google-oauth-disabled-client-secret';

export function isGoogleOAuthConfigured(configService: ConfigService): boolean {
  if (configService.get<string>('GOOGLE_OAUTH_ENABLED') === 'false') {
    return false;
  }

  return Boolean(
    configService.get<string>('GOOGLE_CLIENT_ID') &&
      configService.get<string>('GOOGLE_CLIENT_SECRET'),
  );
}

export function getGoogleOAuthClientId(configService: ConfigService): string {
  return (
    configService.get<string>('GOOGLE_CLIENT_ID') || DISABLED_GOOGLE_CLIENT_ID
  );
}

export function getGoogleOAuthClientSecret(
  configService: ConfigService,
): string {
  return (
    configService.get<string>('GOOGLE_CLIENT_SECRET') ||
    DISABLED_GOOGLE_CLIENT_SECRET
  );
}
