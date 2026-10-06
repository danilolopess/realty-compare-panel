import pg from 'pg';
export declare function prepararAuth(): Promise<void>;
export declare function query<T extends pg.QueryResultRow>(text: string, params?: unknown[]): Promise<{
    ok: true;
    rows: T[];
} | {
    ok: false;
}>;
