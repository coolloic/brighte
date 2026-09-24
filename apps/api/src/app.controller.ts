import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/decorators.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Public: Playwright uses it as the API readiness check.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
