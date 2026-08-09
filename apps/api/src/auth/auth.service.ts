import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthActor } from './auth.types';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private get sessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      throw new Error('SESSION_SECRET is required');
    }
    return secret;
  }

  async getSetupStatus() {
    const count = await this.prisma.user.count();
    return { needsSignup: count === 0 };
  }

  /** Create the single local admin. Allowed only when no users exist. */
  async signupAdmin(email: string, password: string) {
    const existing = await this.prisma.user.count();
    if (existing > 0) {
      throw new ConflictException('Admin already exists. Sign in instead.');
    }

    const passwordHash = await hash(password, 12);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    // Claim any unassigned seed issues for the new operator
    await this.prisma.issue.updateMany({
      where: { assigneeId: null },
      data: { assigneeId: user.id },
    });

    return { id: user.id, email: user.email };
  }

  async validateLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { id: user.id, email: user.email };
  }

  createSessionToken(userId: string): string {
    const exp = Date.now() + SESSION_TTL_MS;
    const payload = `${userId}.${exp}`;
    const sig = createHmac('sha256', this.sessionSecret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  verifySessionToken(token: string): { userId: string } | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [userId, expStr, sig] = parts;
    const payload = `${userId}.${expStr}`;
    const expected = createHmac('sha256', this.sessionSecret)
      .update(payload)
      .digest('base64url');
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    } catch {
      return null;
    }
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    return { userId };
  }

  private hashApiToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private parseBearer(header?: string): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(/\s+/);
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
    return token;
  }

  async createApiToken(userId: string, name = 'MCP') {
    const raw = `hbr_${randomBytes(32).toString('base64url')}`;
    const tokenHash = this.hashApiToken(raw);
    const prefix = raw.slice(0, 12);

    const row = await this.prisma.apiToken.create({
      data: {
        userId,
        name: name.trim() || 'MCP',
        tokenHash,
        prefix,
      },
    });

    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      createdAt: row.createdAt,
      lastUsedAt: null as Date | null,
      /** Plaintext — shown once. Put in `.cursor/mcp.json` as KANBAN_API_TOKEN. */
      token: raw,
    };
  }

  async listApiTokens(userId: string) {
    const rows = await this.prisma.apiToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    return rows;
  }

  async revokeApiToken(userId: string, tokenId: string) {
    const row = await this.prisma.apiToken.findFirst({
      where: { id: tokenId, userId, revokedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Token not found');
    }
    await this.prisma.apiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /** Resolve Bearer auth against DB ApiTokens (created in Harbor → MCP tokens). */
  async resolveBearerActor(header?: string): Promise<AuthActor | null> {
    const raw = this.parseBearer(header);
    if (!raw) return null;

    const tokenHash = this.hashApiToken(raw);
    const row = await this.prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (row && !row.revokedAt) {
      void this.prisma.apiToken
        .update({
          where: { id: row.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => undefined);
      return { id: row.user.id, email: row.user.email, via: 'bearer' };
    }

    return null;
  }

  async resolveSessionUser(userId: string): Promise<AuthActor> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Session user not found');
    }
    return { id: user.id, email: user.email, via: 'session' };
  }

  async getMe(actor: AuthActor) {
    return { id: actor.id, email: actor.email, via: actor.via };
  }
}
