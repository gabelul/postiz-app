import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

/**
 * AdminGuard - Restricts access to admin-only routes
 *
 * This guard checks if the authenticated user has superAdmin privileges.
 * Only users with isSuperAdmin === true can access routes protected by this guard.
 *
 * Usage: @UseGuards(AdminGuard)
 * Example:
 *   @Get('/admin/users')
 *   @UseGuards(AdminGuard)
 *   async getUsers() { ... }
 *
 * @throws ForbiddenException if user is not a superAdmin
 */
@Injectable()
export class AdminGuard implements CanActivate {
  /**
   * Validates that the user has admin privileges
   * @param context - NestJS execution context containing the request
   * @returns true if user is superAdmin, throws ForbiddenException otherwise
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user exists
    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // Check if user has superAdmin flag
    if (!user.isSuperAdmin) {
      throw new ForbiddenException(
        'Admin access required. Only superAdmins can access this resource.'
      );
    }

    return true;
  }
}
