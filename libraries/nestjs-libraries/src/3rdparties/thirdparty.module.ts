import { Module } from '@nestjs/common';
import { HeygenProvider } from '@gitroom/nestjs-libraries/3rdparties/heygen/heygen.provider';
import { ThirdPartyManager } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.manager';
import { DatabaseModule } from '@gitroom/nestjs-libraries/database/prisma/database.module';

/**
 * Third Party Module - Manages third-party integrations like Heygen.
 * Requires DatabaseModule so ThirdPartyManager can resolve dependencies.
 *
 * Note: ThirdPartyManager uses OnModuleInit to lazily resolve ThirdPartyService
 * from the imported DatabaseModule. This avoids NestJS's compile-time DI validation
 * which fails when trying to inject services from imported @Global() modules.
 * The OnModuleInit hook defers resolution until after module initialization,
 * at which point all parent modules have been loaded and ModuleRef can find the service.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    HeygenProvider,
    /**
     * ThirdPartyManager - Uses OnModuleInit for lazy dependency resolution
     *
     * Instead of injecting ThirdPartyService in the constructor (which causes
     * NestJS DI validation to fail), ThirdPartyManager only requires ModuleRef
     * and resolves ThirdPartyService in the onModuleInit() lifecycle hook.
     * This works because by that time, all imported modules are initialized.
     */
    ThirdPartyManager,
  ],
  exports: [HeygenProvider, ThirdPartyManager],
})
export class ThirdPartyModule {}
