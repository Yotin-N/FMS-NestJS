/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Request,
  Post,
  UseGuards,
  Res,
  Get,
  Body,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GoogleAuthGuard } from './google-auth.guard';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { Response } from 'express';
import { LoginDto } from '../user/dto/user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';

// Example response classes for Swagger documentation
class LoginResponseDto {
  @ApiProperty({ example: 'Login successful' })
  message: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      role: 'USER',
    },
  })
  user: any;
}

class GoogleUserDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
    },
  })
  user: any;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService,
    private readonly jwtService: JwtService
  ) { }

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({
    type: LoginDto,
    examples: {
      normalUser: {
        value: {
          email: 'user@example.com',
          password: 'password123',
        },
        summary: 'Normal User Login',
      },
      adminUser: {
        value: {
          email: 'admin@example.com',
          password: 'adminPass123',
        },
        summary: 'Admin User Login',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns access token and user info',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid credentials',
  })
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

  //Refresh Token Endpoint
  @Post('/refresh-token')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Return a new access token',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthrized - invalid or expried token',
  })
  async refreshToken(@Body() refreshTokenDto: { token: string }) {
    try {
      const decoded = this.jwtService.verify(refreshTokenDto.token);

      const tokenIssuedAt = decoded.iat * 1000;
      const now = Date.now();
      const tokenAge = now - tokenIssuedAt;
      const maxRefreshAge = 7 * 24 * 60 * 60 * 1000;

      if (tokenAge > maxRefreshAge) {
        throw new UnauthorizedException('Token too old to refresh');

        const user = {
          userId: decoded.sub,
          email: decoded.email,
          role: decoded.role
        };

        const result = this.authService.login(
          user
        );

        return {
          accessToken: result.accessToken,
          user: result.user,
        };
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }






  @Post('/direct-login')
  @ApiOperation({ summary: 'Direct login without passport (for debugging)' })
  @ApiBody({
    type: LoginDto,
    examples: {
      example: {
        value: {
          email: 'user@example.com',
          password: 'password123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async directLogin(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`Direct login attempt for user: ${loginDto.email}`);

    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

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
  @ApiOperation({ summary: 'Initiate Google OAuth authentication' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google authentication',
  })
  async googleAuth(@Request() req) {
    // This part is handled by Google OAuth Strategy
  }

  @UseGuards(GoogleAuthGuard)
  @Get('/google/callback')
  @ApiOperation({ summary: 'Google OAuth callback endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: GoogleUserDto,
  })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  async googleAuthRedirect(@Request() req, @Res() res: Response) {
    try {
      const result = await this.authService.googleLogin(req);

      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
      });

      return res.redirect(
        `http://localhost:3001/auth/google/callback?token=${encodeURIComponent(result.accessToken)}&userId=${result.user.id}`,
      );
    } catch (error) {
      console.error('Google auth error:', error);
      return res.redirect(
        `http://localshot:3001/login?error=${encodeURIComponent('Google authentication failed')}`,
      );
    }
  }
}
