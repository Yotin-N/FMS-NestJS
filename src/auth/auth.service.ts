import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  // Just this method needs fixing
  async validateUser(email: string, password: string): Promise<any> {
    // Add true parameter to retrieve password
    const user = await this.userService.findByEmail(email, true);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has a password (should have one if registered normally)
    if (!user.password) {
      // If no password but has googleId, it was created with OAuth
      if (user.googleId) {
        throw new UnauthorizedException(
          'This account was created with Google. Please log in using Google.',
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }

  login(user: any) {
    const payload = {
      email: user.email,
      sub: user.userId,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.userId,
        email: user.email,
        role: user.role,
      },
    };
  }

  async googleLogin(req): Promise<any> {
    if (!req.user) {
      throw new Error('Google login failed: No user information received.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email, name, picture, googleId } = req.user;
    let user = await this.userService.findByEmail(email);

    if (!user) {
      // Split name into first and last
      const nameParts = name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Create new user
      user = await this.userService.create({
        email,
        firstName,
        lastName,
        // Set a random password that won't be used (OAuth users authenticate through the provider)
        password: Math.random().toString(36).slice(-12),
      });

      // Update additional Google-specific fields
      user.googleId = googleId;
      await this.userRepository.save(user);
    } else if (!user.googleId) {
      // Update existing user with Google ID if they didn't have one
      user.googleId = googleId;
      await this.userRepository.save(user);
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
