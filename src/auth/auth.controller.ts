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
} from '@nestjs/common';
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

  constructor(private readonly authService: AuthService) {}

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
    const result = await this.authService.googleLogin(req);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
    });

    return res.redirect('http://localhost:3001/dashboard');
  }
}
