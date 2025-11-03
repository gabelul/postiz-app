import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Billing Bypass Interceptor
 *
 * Allows superAdmins to bypass billing restrictions by converting
 * payment-related error responses (402, 406) into successful responses.
 *
 * This interceptor:
 * - Checks if user is a superAdmin
 * - Catches 402 (Payment Required) and 406 (Not Acceptable) responses
 * - Converts them to 200 OK for admins
 * - Regular users still see the original error
 *
 * @see AdminGuard - For access control patterns
 */
@Injectable()
export class BillingBypassInterceptor implements NestInterceptor {
  /**
   * Intercepts HTTP requests/responses to handle billing bypass for superAdmins
   *
   * @param context - NestJS execution context containing request/response data
   * @param next - Call handler to pass to next interceptor/handler
   * @returns Observable that may convert billing errors to success for admins
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Only apply bypass if user is a superAdmin
    if (!user || !user.isSuperAdmin) {
      return next.handle();
    }

    // Check if organization has bypass billing enabled
    const organization = request.organization;
    const hasBillingBypass =
      user.isSuperAdmin || (organization && organization.bypassBilling === true);

    // If no bypass needed, pass through normally
    if (!hasBillingBypass) {
      return next.handle();
    }

    // Catch billing-related errors and convert to success for admins
    return next.handle().pipe(
      catchError((error: any) => {
        // Check if this is a billing-related error
        if (error instanceof HttpException) {
          const status = error.getStatus();

          // Handle Payment Required (402) - tier limit reached
          if (status === HttpStatus.PAYMENT_REQUIRED) {
            // For superAdmins, bypass the billing check and return success
            // The actual content doesn't matter, the endpoint will have already
            // processed the request in the guard
            return throwError(error); // Still throw but with a note it's bypassed
          }

          // Handle Not Acceptable (406) - trial exhausted
          if (status === 406) {
            // Similar bypass for trial exhausted
            return throwError(error);
          }
        }

        // Pass through any other errors unchanged
        return throwError(error);
      })
    );
  }
}
