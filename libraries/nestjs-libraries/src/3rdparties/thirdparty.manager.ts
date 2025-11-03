import {
  ThirdPartyAbstract,
  ThirdPartyParams,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ThirdPartyService } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.service';

/**
 * ThirdPartyManager - Manages third-party integrations
 *
 * Uses @Injectable() to allow NestJS to manage dependency injection.
 * ThirdPartyService is lazily resolved via ModuleRef.get() after module initialization,
 * avoiding NestJS's compile-time dependency resolution which fails when trying to inject
 * services from imported @Global() modules into this module's providers.
 *
 * This solves the circular dependency issue where:
 * - ThirdPartyModule imports DatabaseModule
 * - NestJS validates that ThirdPartyManager's dependencies are resolvable during module init
 * - But ThirdPartyService is from the imported DatabaseModule, not a local provider
 * - By deferring resolution to OnModuleInit, we bypass compile-time validation
 */
@Injectable()
export class ThirdPartyManager implements OnModuleInit {
  /**
   * Lazily resolved ThirdPartyService instance. Resolved during the onModuleInit hook to avoid
   * compile-time DI validation while still providing type safety within this class.
   */
  private _thirdPartyService: ThirdPartyService | null = null;

  constructor(private _moduleRef: ModuleRef) {}

  /**
   * Initialize ThirdPartyService after module initialization is complete.
   * This allows ModuleRef.get() to successfully find ThirdPartyService from DatabaseModule.
   */
  onModuleInit() {
    this._thirdPartyService = this._moduleRef.get<ThirdPartyService>(ThirdPartyService, {
      strict: false,
    });

    if (!this._thirdPartyService) {
      throw new Error('ThirdPartyService could not be resolved by ThirdPartyManager');
    }
  }

  private get thirdPartyService(): ThirdPartyService {
    if (!this._thirdPartyService) {
      throw new Error('ThirdPartyService requested before ThirdPartyManager initialization completed');
    }

    return this._thirdPartyService;
  }

  getAllThirdParties(): any[] {
    return (Reflect.getMetadata('third:party', ThirdPartyAbstract) || []).map(
      (p: any) => ({
        identifier: p.identifier,
        title: p.title,
        description: p.description,
        fields: p.fields || [],
      })
    );
  }

  getThirdPartyByName(
    identifier: string
  ): (ThirdPartyParams & { instance: ThirdPartyAbstract }) | undefined {
    const thirdParty = (
      Reflect.getMetadata('third:party', ThirdPartyAbstract) || []
    ).find((p: any) => p.identifier === identifier);

    return { ...thirdParty, instance: this._moduleRef.get(thirdParty.target) };
  }

  deleteIntegration(org: string, id: string) {
    return this.thirdPartyService.deleteIntegration(org, id);
  }

  getIntegrationById(org: string, id: string) {
    return this.thirdPartyService.getIntegrationById(org, id);
  }

  getAllThirdPartiesByOrganization(org: string) {
    return this.thirdPartyService.getAllThirdPartiesByOrganization(org);
  }

  saveIntegration(
    org: string,
    identifier: string,
    apiKey: string,
    data: { name: string; username: string; id: string }
  ) {
    return this.thirdPartyService.saveIntegration(
      org,
      identifier,
      apiKey,
      data
    );
  }
}
