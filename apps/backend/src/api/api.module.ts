import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController } from '@gitroom/backend/api/routes/auth.controller';
import { AuthService } from '@gitroom/backend/services/auth/auth.service';
import { UsersController } from '@gitroom/backend/api/routes/users.controller';
import { AuthMiddleware } from '@gitroom/backend/services/auth/auth.middleware';
import { StripeController } from '@gitroom/backend/api/routes/stripe.controller';
import { StripeService } from '@gitroom/nestjs-libraries/services/stripe.service';
import { AnalyticsController } from '@gitroom/backend/api/routes/analytics.controller';
import { PoliciesGuard } from '@gitroom/backend/services/auth/permissions/permissions.guard';
import { PermissionsService } from '@gitroom/backend/services/auth/permissions/permissions.service';
import { IntegrationsController } from '@gitroom/backend/api/routes/integrations.controller';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { SettingsController } from '@gitroom/backend/api/routes/settings.controller';
import { PostsController } from '@gitroom/backend/api/routes/posts.controller';
import { MediaController } from '@gitroom/backend/api/routes/media.controller';
import { UploadModule } from '@gitroom/nestjs-libraries/upload/upload.module';
import { BillingController } from '@gitroom/backend/api/routes/billing.controller';
import { NotificationsController } from '@gitroom/backend/api/routes/notifications.controller';
import { MarketplaceController } from '@gitroom/backend/api/routes/marketplace.controller';
import { MessagesController } from '@gitroom/backend/api/routes/messages.controller';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@gitroom/nestjs-libraries/openai/extract.content.service';
import { CodesService } from '@gitroom/nestjs-libraries/services/codes.service';
import { CopilotController } from '@gitroom/backend/api/routes/copilot.controller';
import { AgenciesController } from '@gitroom/backend/api/routes/agencies.controller';
import { PublicController } from '@gitroom/backend/api/routes/public.controller';
import { RootController } from '@gitroom/backend/api/routes/root.controller';
import { TrackService } from '@gitroom/nestjs-libraries/track/track.service';
import { ShortLinkService } from '@gitroom/nestjs-libraries/short-linking/short.link.service';
import { Nowpayments } from '@gitroom/nestjs-libraries/crypto/nowpayments';
import { WebhookController } from '@gitroom/backend/api/routes/webhooks.controller';
import { SignatureController } from '@gitroom/backend/api/routes/signature.controller';
import { AutopostController } from '@gitroom/backend/api/routes/autopost.controller';
import { SetsController } from '@gitroom/backend/api/routes/sets.controller';
import { ThirdPartyController } from '@gitroom/backend/api/routes/third-party.controller';
import { MonitorController } from '@gitroom/backend/api/routes/monitor.controller';
import { AdminUsersController } from '@gitroom/backend/api/routes/admin/users.controller';
import { AdminOrganizationsController } from '@gitroom/backend/api/routes/admin/organizations.controller';
import { AdminSettingsController } from '@gitroom/backend/api/routes/admin/settings.controller';
import { AdminAIProvidersController } from '@gitroom/backend/api/routes/admin/ai-providers.controller';
import { AdminDashboardController } from '@gitroom/backend/api/routes/admin/dashboard.controller';
import { AdminEmailSettingsController } from '@gitroom/backend/api/routes/admin/email-settings.controller';
import { BulkOperationsController } from '@gitroom/backend/api/routes/admin/bulk-operations.controller';
import { AdminHealthController } from '@gitroom/backend/api/routes/admin/health.controller';
import { AIProvidersService } from '@gitroom/backend/services/ai/ai-providers.service';
import { AdminDashboardService } from '@gitroom/backend/services/admin/admin-dashboard.service';
import { EncryptedSettingsService } from '@gitroom/backend/services/admin/encrypted-settings.service';
import { AdminEmailService } from '@gitroom/backend/services/admin/admin-email.service';
import { BulkOperationsService } from '@gitroom/backend/services/admin/bulk-operations.service';
import { AdminAuditService } from '@gitroom/backend/services/admin/admin-audit.service';

const authenticatedController = [
  UsersController,
  AnalyticsController,
  IntegrationsController,
  SettingsController,
  PostsController,
  MediaController,
  BillingController,
  NotificationsController,
  MarketplaceController,
  MessagesController,
  CopilotController,
  AgenciesController,
  WebhookController,
  SignatureController,
  AutopostController,
  SetsController,
  ThirdPartyController,
];
@Module({
  imports: [UploadModule],
  controllers: [
    RootController,
    StripeController,
    AuthController,
    PublicController,
    MonitorController,
    // Admin Controllers - Require superAdmin privileges
    AdminUsersController,
    AdminOrganizationsController,
    AdminSettingsController,
    AdminAIProvidersController,
    AdminDashboardController,
    AdminEmailSettingsController,
    BulkOperationsController,
    AdminHealthController,
    ...authenticatedController,
  ],
  providers: [
    AuthService,
    StripeService,
    OpenaiService,
    ExtractContentService,
    AuthMiddleware,
    PoliciesGuard,
    PermissionsService,
    CodesService,
    IntegrationManager,
    TrackService,
    ShortLinkService,
    Nowpayments,
    AIProvidersService,
    AdminDashboardService,
    EncryptedSettingsService,
    AdminEmailService,
    BulkOperationsService,
    AdminAuditService,
  ],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply AuthMiddleware to all authenticated controllers AND admin controllers
    // Admin controllers need request.user populated for AdminGuard to work
    consumer.apply(AuthMiddleware).forRoutes(
      ...authenticatedController,
      AdminUsersController,
      AdminOrganizationsController,
      AdminSettingsController,
      AdminAIProvidersController,
      AdminDashboardController,
      AdminEmailSettingsController,
      BulkOperationsController,
      AdminHealthController
    );
  }
}
