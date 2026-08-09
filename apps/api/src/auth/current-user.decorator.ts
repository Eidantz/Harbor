import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthActor } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthActor => {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthActor }>();
    return req.user;
  },
);
