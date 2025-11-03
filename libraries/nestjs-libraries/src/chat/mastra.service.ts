import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { pStore } from '@gitroom/nestjs-libraries/chat/mastra.store';
import { Injectable, Logger } from '@nestjs/common';
import { LoadToolsService } from '@gitroom/nestjs-libraries/chat/load.tools.service';

@Injectable()
export class MastraService {
  static mastra: Mastra;
  private readonly logger = new Logger(MastraService.name);
  constructor(private _loadToolsService: LoadToolsService) {}
  async mastra() {
    // Early return if Mastra is disabled
    if (process.env.DISABLE_MASTRA === 'true') {
      return null;
    }

    // Use the PostgreSQL store for Mastra
    if (!pStore || !process.env.DATABASE_URL) {
      this.logger.error(
        'Mastra storage is not configured. Ensure DATABASE_URL is set and reachable.'
      );
      throw new Error('Mastra storage is not configured');
    }

    MastraService.mastra =
      MastraService.mastra ||
      new Mastra({
        storage: pStore,
        agents: {
          postiz: await this._loadToolsService.agent(),
        },
        logger: new ConsoleLogger({
          level: 'info',
        }),
      });

    return MastraService.mastra;
  }
}
