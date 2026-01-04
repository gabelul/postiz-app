import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { getPostgresStore } from '@gitroom/nestjs-libraries/chat/mastra.store';
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

    // Get the PostgreSQL store (lazily initialized)
    const pStore = getPostgresStore();
    if (!pStore) {
      this.logger.error(
        'Mastra storage is not configured. Ensure DATABASE_URL is set and reachable.'
      );
      return null;
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
