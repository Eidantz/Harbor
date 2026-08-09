import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE } from '../common/constants';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthActor } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<
      Request & { user?: AuthActor; cookies?: Record<string, string> }
    >();

    const bearerUser = await this.auth.resolveBearerActor(
      req.headers.authorization,
    );
    if (bearerUser) {
      req.user = bearerUser;
      return true;
    }

    const cookie = req.cookies?.[SESSION_COOKIE];
    if (cookie) {
      const parsed = this.auth.verifySessionToken(cookie);
      if (parsed) {
        req.user = await this.auth.resolveSessionUser(parsed.userId);
        return true;
      }
    }

    throw new UnauthorizedException('Authentication required');
  }
}
