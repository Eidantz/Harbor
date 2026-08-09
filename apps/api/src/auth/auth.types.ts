export type AuthVia = 'session' | 'bearer';

export interface AuthActor {
  id: string;
  email: string;
  via: AuthVia;
}
