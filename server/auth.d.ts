import type { IncomingMessage } from 'node:http';
export declare const MIN_PASSWORD_LENGTH = 8;
export declare function allowedEmail(): string | null;
export declare function emailsMatch(input: string, allowed: string): boolean;
export declare function credentialsOk(email: string, password: string): Promise<boolean>;
export declare function verifyCurrentPassword(password: string): Promise<boolean>;
export type ChangePasswordResult = {
    ok: true;
} | {
    ok: false;
    reason: 'mismatch' | 'weak' | 'confirm' | 'db';
};
export declare function changeStoredPassword(current: string, next: string, confirm: string): Promise<ChangePasswordResult>;
export declare function clientIp(req: IncomingMessage): string;
export declare function isLoginRateLimited(ip: string): boolean;
export declare function recordLoginFailure(ip: string): void;
export declare function clearLoginFailures(ip: string): void;
