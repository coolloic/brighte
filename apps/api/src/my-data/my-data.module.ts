import { Module, type OnModuleInit } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { createEmbedder, Embedder } from './embedder.js';
import { MyDataDocument } from './my-data-document.model.js';
import { assertMyDataAllowed } from './my-data.config.js';
import { MyDataResolver } from './my-data.resolver.js';
import { MyDataService } from './my-data.service.js';

@Module({
  imports: [SequelizeModule.forFeature([MyDataDocument])],
  providers: [MyDataService, MyDataResolver, { provide: Embedder, useFactory: () => createEmbedder() }],
})
export class MyDataModule implements OnModuleInit {
  // At init, not import: the .env files are loaded into process.env by ConfigModule by then.
  onModuleInit() {
    assertMyDataAllowed();
  }
}
