import { Controller, Request, Post, UseGuards, Res, Get } from '@nestjs/common';
import { GoogleAuthGuard } from './google-auth.guard';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Request() req, @Res({ passthrough: true }) res) {
    const { accessToken } = this.authService.login(req.user);
    res.cookie('access_token', accessToken, {
      httpOnly: true,
    });

    return {
      message: 'Login successful',
    };
  }

  @UseGuards(GoogleAuthGuard)
  @Get('/google')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async googleAuth(@Request() req) {}

  @UseGuards(GoogleAuthGuard)
  @Get('/google/callback')
  async googleAuthRedirect(
    @Request() req,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Res({ passthrough: true }) res,
  ) {
    const { accessToken } = await this.authService.googleLogin(req);
    res.cookie('access_token', accessToken, {
      httpOnly: true,
    });
    return { accessToken };
  }
}
