import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from '../admin.guard';

/**
 * Unit tests for AdminGuard
 *
 * The AdminGuard protects admin routes by ensuring only superAdmins can access them.
 * This test verifies:
 * - Superadmins are allowed to proceed
 * - Regular users are forbidden
 * - Missing user context returns forbidden
 */
describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminGuard],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
  });

  /**
   * Test: Superadmin user can access protected routes
   * Verifies that a user with isSuperAdmin=true passes the guard
   */
  it('should allow superadmin users to access protected routes', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user-123',
            email: 'admin@example.com',
            isSuperAdmin: true,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  /**
   * Test: Regular user cannot access protected routes
   * Verifies that a user with isSuperAdmin=false is forbidden
   */
  it('should forbid regular users from accessing protected routes', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user-456',
            email: 'user@example.com',
            isSuperAdmin: false,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(false);
  });

  /**
   * Test: Missing user context returns forbidden
   * Verifies that requests without a user object are forbidden
   */
  it('should forbid requests without user context', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: undefined,
        }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(false);
  });

  /**
   * Test: User with isSuperAdmin=null is forbidden
   * Verifies that undefined/null isSuperAdmin is treated as false
   */
  it('should forbid users where isSuperAdmin is not explicitly true', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user-789',
            email: 'user2@example.com',
            isSuperAdmin: null,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(false);
  });
});
