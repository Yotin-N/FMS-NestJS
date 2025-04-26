import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.email) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const userEntity = await this.userService.findByEmail(user.email);

    if (!userEntity) {
      return false;
    }

    const hasRole = requiredRoles.some((role) => userEntity.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        'You do not have sufficient permissions to perform this action',
      );
    }

    return hasRole;
  }
}
