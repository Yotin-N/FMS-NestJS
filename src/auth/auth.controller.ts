import {
  Controller,
  Request,
  Post,
  UseGuards,
  Res,
  Get,
  Body,
  Logger,
} from '@nestjs/common';
import { GoogleAuthGuard } from './google-auth.guard';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { Response } from 'express';
import { LoginDto } from '../user/dto/user.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    this.logger.debug(`Login attempt successful for user: ${req.user.email}`);
    const result = this.authService.login(req.user);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
    });

    return {
      message: 'Login successful',
      ...result,
    };
  }

  // Direct login endpoint that bypasses passport (for debugging purposes)
  @Post('/direct-login')
  async directLogin(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`Direct login attempt for user: ${loginDto.email}`);

    // Manually validate user
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    // Generate tokens and login
    const result = this.authService.login(user);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
    });

    return {
      message: 'Login successful',
      ...result,
    };
  }

  @UseGuards(GoogleAuthGuard)
  @Get('/google')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async googleAuth(@Request() req) {
    // ส่วนนี้จะถูกจัดการโดย Google OAuth Strategy
  }

  @UseGuards(GoogleAuthGuard)
  @Get('/google/callback')
  async googleAuthRedirect(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleLogin(req);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
    });

    return result;
  }
}
