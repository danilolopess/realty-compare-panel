import type { IncomingMessage, ServerResponse } from 'node:http';
export declare function pathname(req: IncomingMessage): string;
export declare function json(res: ServerResponse, status: number, body: unknown): void;
export declare function tratar(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void): Promise<void>;
export declare function prepararLogin(): void;
