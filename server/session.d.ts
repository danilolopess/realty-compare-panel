import type { IncomingMessage, ServerResponse } from 'node:http';
import { type SessionOptions } from 'iron-session';
export declare const SESSION_TTL_SECONDS: number;
export type SessionData = {
    isLoggedIn: boolean;
    email: string;
};
export declare function segredoOk(): boolean;
export declare function getSessionOptions(): SessionOptions;
export declare function getSession(req: IncomingMessage, res: ServerResponse): Promise<import("iron-session").IronSession<SessionData>>;
