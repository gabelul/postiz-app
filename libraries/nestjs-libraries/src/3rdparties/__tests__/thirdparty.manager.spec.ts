import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { ThirdPartyManager } from '../thirdparty.manager';
import { ThirdPartyService } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.service';

describe('ThirdPartyManager', () => {
  it('resolves ThirdPartyService lazily without triggering DI errors', async () => {
    const thirdPartyServiceMock = {
      deleteIntegration: jest.fn(),
      getIntegrationById: jest.fn().mockReturnValue('integration'),
      getAllThirdPartiesByOrganization: jest.fn(),
      saveIntegration: jest.fn(),
    } as unknown as ThirdPartyService;

    const testingModule = await Test.createTestingModule({
      providers: [
        ThirdPartyManager,
        {
          provide: ThirdPartyService,
          useValue: thirdPartyServiceMock,
        },
      ],
    }).compile();

    const moduleRef = testingModule.get(ModuleRef);
    const moduleRefGetSpy = jest.spyOn(moduleRef, 'get');

    await testingModule.init();

    const manager = testingModule.get(ThirdPartyManager);
    const result = manager.getIntegrationById('org', 'id');

    expect(moduleRefGetSpy).toHaveBeenCalledWith(
      ThirdPartyService,
      expect.objectContaining({
        strict: false,
      })
    );
    expect(thirdPartyServiceMock.getIntegrationById).toHaveBeenCalledWith('org', 'id');
    expect(result).toBe('integration');
  });
});
