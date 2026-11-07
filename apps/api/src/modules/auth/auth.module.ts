import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV, Env } from '../../config/env';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { PermissionsLoader } from './permissions.loader';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_ACCESS_SECRET }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    PermissionsLoader,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [PasswordService, PermissionsLoader],
})
export class AuthModule {}
