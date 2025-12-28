import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Query,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { AdminGuard } from '@gitroom/nestjs-libraries/guards/admin.guard';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Throttle } from '@nestjs/throttler';
import type { $Enums } from '@prisma/client';
import { safeJsonParse } from '@gitroom/nestjs-libraries/utils';

/**
 * Admin Users Controller
 *
 * Manages user administration including:
 * - Listing all users
 * - Promoting/demoting users to/from superAdmin
 * - Setting custom quotas for users
 *
 * All endpoints require superAdmin privileges (protected by AdminGuard)
 * @see AdminGuard
 */
@ApiTags('Admin - Users')
@Controller('/api/admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  /**
   * Constructor
   * @param _prismaService - Prisma database service
   */
  constructor(private readonly _prismaService: PrismaService) {}

  /**
   * List all users in the system with pagination
   *
   * @param take - Number of records to return (default: 50, max: 500)
   * @param skip - Number of records to skip (default: 0)
   * @param search - Optional search by email or name
   * @returns Paginated list of users with basic info
   *
   * @example
   * GET /api/admin/users?take=20&skip=0&search=john
   */
  @Get('/')
  @ApiOperation({
    summary: 'List all users with pagination',
    description: 'Returns paginated list of all users in system',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    schema: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              isSuperAdmin: { type: 'boolean' },
              createdAt: { type: 'string' },
              organizations: { type: 'array' },
            },
          },
        },
        total: { type: 'number' },
        skip: { type: 'number' },
        take: { type: 'number' },
      },
    },
  })
  async listUsers(
    @Query('take') take: string = '50',
    @Query('skip') skip: string = '0',
    @Query('search') search?: string
  ) {
    // Validate and parse pagination parameters
    const takeNum = Math.min(parseInt(take) || 50, 500);
    const skipNum = Math.max(parseInt(skip) || 0, 0);

    // Build search filter - Use any to work around Prisma typing issues with QueryMode
    const whereClause: any = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    // Fetch users and total count
    const [users, total] = await Promise.all([
      this._prismaService.user.findMany({
        where: whereClause,
        skip: skipNum,
        take: takeNum,
        select: {
          id: true,
          email: true,
          name: true,
          isSuperAdmin: true,
          createdAt: true,
          organizations: {
            select: {
              id: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this._prismaService.user.count({ where: whereClause }),
    ]);

    return {
      users,
      total,
      skip: skipNum,
      take: takeNum,
    };
  }

  /**
   * Get detailed information about a specific user
   *
   * @param userId - The ID of the user
   * @returns User details including organizations and quotas (excluding sensitive data)
   */
  @Get('/:userId')
  @ApiOperation({
    summary: 'Get user details',
    description: 'Retrieve detailed information about a specific user',
  })
  async getUser(@Param('userId') userId: string) {
    // Fetch user with all related data, excluding sensitive fields like password
    const user = await this._prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        bio: true,
        pictureId: true,
        isSuperAdmin: true,
        customQuotas: true,
        lastOnline: true,
        connectedAccount: true,
        createdAt: true,
        updatedAt: true,
        activated: true,
        marketplace: true,
        organizations: {
          select: {
            id: true,
            role: true,
            disabled: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      customQuotas: safeJsonParse(user.customQuotas, null),
    };
  }

  /**
   * Promote a user to superAdmin status
   *
   * Grants full administrative access to the system.
   * User will be able to access all admin endpoints and manage other users.
   *
   * @param userId - The ID of the user to promote
   * @returns Updated user object
   */
  @Post('/:userId/promote')
  @ApiOperation({
    summary: 'Promote user to superAdmin',
    description: 'Grant superAdmin privileges to a user',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async promoteToAdmin(
    @Param('userId') userId: string,
    @GetUserFromRequest() requestUser: User
  ) {
    // Prevent self-promotion for security
    if (userId === requestUser.id) {
      throw new ForbiddenException('Cannot promote yourself to superAdmin');
    }

    // Use transaction to prevent race condition
    return this._prismaService.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if already admin
      if (user.isSuperAdmin) {
        throw new BadRequestException('User is already a superAdmin');
      }

      // Update user to superAdmin
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { isSuperAdmin: true },
        select: {
          id: true,
          email: true,
          name: true,
          isSuperAdmin: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        message: `User promoted to superAdmin`,
        user: updatedUser,
      };
    });
  }

  /**
   * Demote a user from superAdmin status
   *
   * Removes administrative access. User becomes regular user.
   * Cannot demote the only superAdmin in the system.
   *
   * @param userId - The ID of the user to demote
   * @returns Updated user object
   */
  @Post('/:userId/demote')
  @ApiOperation({
    summary: 'Demote user from superAdmin',
    description: 'Remove superAdmin privileges from a user',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async demoteFromAdmin(
    @Param('userId') userId: string,
    @GetUserFromRequest() requestUser: User
  ) {
    // Prevent self-demotion
    if (userId === requestUser.id) {
      throw new ForbiddenException('Cannot demote yourself from superAdmin');
    }

    // Use transaction to prevent race condition
    return this._prismaService.$transaction(async (tx) => {
      // Fetch user to check current status
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Count remaining superAdmins
      const superAdminCount = await tx.user.count({
        where: { isSuperAdmin: true },
      });

      // Prevent demoting the only superAdmin
      if (user.isSuperAdmin && superAdminCount <= 1) {
        throw new ForbiddenException(
          'Cannot demote the only superAdmin in the system. Promote another user first.'
        );
      }

      // Update user to regular user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { isSuperAdmin: false },
        select: {
          id: true,
          email: true,
          name: true,
          isSuperAdmin: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        message: 'User demoted from superAdmin',
        user: updatedUser,
      };
    });
  }

  /**
   * Set custom quotas for a user
   *
   * Allows admin to override system-wide quotas for specific users.
   * Quotas are stored as JSON for flexibility.
   *
   * @param userId - The ID of the user
   * @param body - Custom quotas object (e.g., { posts_per_month: 1000, channels: 10 })
   * @returns Updated user object
   *
   * @example
   * POST /api/admin/users/:userId/quotas
   * {
   *   "posts_per_month": 1000,
   *   "image_generation_count": 100,
   *   "channels": 20
   * }
   */
  @Put('/:userId/quotas')
  @ApiOperation({
    summary: 'Set custom user quotas',
    description: 'Override system quotas for a specific user',
  })
  async setUserQuotas(
    @Param('userId') userId: string,
    @Body() body: Record<string, any>
  ) {
    // Fetch user to verify existence
    const user = await this._prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate quotas object
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Quotas must be a valid object');
    }

    // Update user with custom quotas
    const updatedUser = await this._prismaService.user.update({
      where: { id: userId },
      data: {
        customQuotas: JSON.stringify(body),
      },
      select: {
        id: true,
        email: true,
        name: true,
        customQuotas: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      message: 'Custom quotas set for user',
      user: {
        ...updatedUser,
        customQuotas: safeJsonParse(updatedUser.customQuotas, {}),
      },
    };
  }

  /**
   * Remove custom quotas for a user
   *
   * Resets user to system-wide quotas.
   *
   * @param userId - The ID of the user
   * @returns Updated user object
   */
  @Post('/:userId/quotas/reset')
  @ApiOperation({
    summary: 'Reset user quotas to system defaults',
    description: 'Remove custom quotas and revert to system-wide quotas',
  })
  async resetUserQuotas(@Param('userId') userId: string) {
    // Fetch user to verify existence
    const user = await this._prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Reset quotas to null
    const updatedUser = await this._prismaService.user.update({
      where: { id: userId },
      data: {
        customQuotas: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        customQuotas: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      message: 'User quotas reset to system defaults',
      user: updatedUser,
    };
  }
}
