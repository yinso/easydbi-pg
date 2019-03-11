import * as Promise from 'bluebird';
import * as DBI from 'easydbi';
export interface PostgresOptions extends DBI.DriverOptions {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    connectionString?: string;
    keepAlive?: boolean;
    statement_timeout?: false | number;
}
export declare function isPostgresOptions(v: any): v is PostgresOptions;
export declare class PostgresDriver extends DBI.Driver {
    private readonly connection;
    private _inner;
    private _transStack;
    constructor(key: string, options: DBI.DriverOptions);
    private _normalizeOptions;
    connectAsync(): Promise<PostgresDriver>;
    isConnected(): boolean;
    queryAsync(stmt: DBI.QueryType, args?: DBI.QueryArgs): Promise<DBI.ResultRecord[]>;
    execAsync(stmt: DBI.QueryType, args?: DBI.QueryArgs): Promise<void>;
    beginAsync(): Promise<void>;
    commitAsync(): Promise<void>;
    rollbackAsync(): Promise<void>;
    private _savePointName;
    private _normalizeArgs;
    private _arrayifyOptions;
    disconnectAsync(): Promise<void>;
}
