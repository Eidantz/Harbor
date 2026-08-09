import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SESSION_COOKIE } from '../common/constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { CreateTokenDto } from './dto/create-token.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from './public.decorator';
import type { AuthActor } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setSessionCookie(res: Response, userId: string) {
    const token = this.auth.createSessionToken(userId);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  private requireSession(user: AuthActor) {
    if (user.via !== 'session') {
      throw new ForbiddenException(
        'MCP token management requires a browser session (sign in to Harbor)',
      );
    }
  }

  @Public()
  @Get('setup')
  @ApiOperation({ summary: 'Whether the single admin still needs to sign up' })
  setup() {
    return this.auth.getSetupStatus();
  }

  @Public()
  @Post('signup')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create the single local admin (only when no users exist); sets session cookie',
  })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.signupAdmin(dto.email, dto.password);
    this.setSessionCookie(res, user.id);
    return { id: user.id, email: user.email };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email/password; sets HTTP-only session cookie' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateLogin(dto.email, dto.password);
    this.setSessionCookie(res, user.id);
    return { id: user.id, email: user.email };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear session cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Current session or Bearer actor' })
  me(@CurrentUser() user: AuthActor) {
    return this.auth.getMe(user);
  }

  @Get('tokens')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List active MCP/API tokens (session only)' })
  listTokens(@CurrentUser() user: AuthActor) {
    this.requireSession(user);
    return this.auth.listApiTokens(user.id);
  }

  @Post('tokens')
  @HttpCode(201)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Create an MCP/API Bearer token (plaintext returned once; session only)',
  })
  createToken(@CurrentUser() user: AuthActor, @Body() dto: CreateTokenDto) {
    this.requireSession(user);
    return this.auth.createApiToken(user.id, dto.name ?? 'MCP');
  }

  @Delete('tokens/:tokenId')
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke an MCP/API token (session only)' })
  revokeToken(
    @CurrentUser() user: AuthActor,
    @Param('tokenId') tokenId: string,
  ) {
    this.requireSession(user);
    return this.auth.revokeApiToken(user.id, tokenId);
  }
}
