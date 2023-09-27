import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { consola } from 'consola';
// import { Logger } from "tslog";

consola.info('sdfsd', { a: { b: 1 } });
console.warn('xddfd', { a: { b: 1 } });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
