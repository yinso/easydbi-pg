import * as Promise from 'bluebird';
import * as pg from 'pg';
import * as DBI from 'easydbi';


export interface PostgresOptions extends DBI.DriverOptions {
    host ?: string;
    port ?: number;
    database ?: string;
    user ?: string;
    password ?: string;
    connectionString?: string;
    keepAlive?: boolean;
    statement_timeout?: false | number;
}

const defaultPostgresOptions : PostgresOptions = {
    host: 'localhost',
    port: 5432,
}

export function isPostgresOptions(v : any) : v is PostgresOptions {
    return DBI.isDriverOptions(v) && ((v as any).memory ? typeof(v.memory) === 'boolean' : true) && ((v as any).filePath ? typeof(v.filePath) === 'string' : true);
}

class Stack<T> {
    private _inner : T[];
    constructor() {
        this._inner = [];
    }

    push(item : T) : void {
        this._inner.push(item);
    }

    get isEmpty() {
        return this._inner.length === 0;
    }

    get size() {
        return this._inner.length;
    }

    pop() : T {
        let result = this._inner.pop();
        if (result === undefined) {
            throw new Error(`StackUnderFlow`)
        }
        return result;
    }
}

export class PostgresDriver extends DBI.Driver {
    private readonly connection : PostgresOptions;
    private _inner !: pg.Client;
    private _transStack : Stack<string>;
    constructor(key : string, options : DBI.DriverOptions) {
        super(key, options);
        this._transStack = new Stack<string>();
        if (isPostgresOptions(options)) {
            this.connection = this._normalizeOptions(options)
        } else {
            throw new Error(`InvalidPostgresOptions`);
        }
    }

    private _normalizeOptions(options : PostgresOptions) : PostgresOptions {
        return { ...defaultPostgresOptions, ...options } as PostgresOptions;
    }

    connectAsync() : Promise<PostgresDriver> {
        return new Promise<PostgresDriver>((resolve, reject) => {
            this._inner = new pg.Client(this.connection);
            this._inner.connect((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(this)
                }
            })
        })
    }

    isConnected() {
        return this._inner instanceof pg.Client;
    }

    queryAsync(stmt : DBI.QueryType, args : DBI.QueryArgs = {}) : Promise<DBI.ResultRecord[]> {
        return new Promise<DBI.ResultRecord[]>((resolve, reject) => {
            let normedArgs = this._normalizeArgs(args);
            let [ normStmt, normArgs ] = DBI.arrayify(stmt, normedArgs, this._arrayifyOptions());
            this._inner.query(normStmt, normArgs, (err, result) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(result.rows)
                }
            });
        })
    }

    execAsync(stmt : DBI.QueryType, args : DBI.QueryArgs = {}) : Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let normedArgs = this._normalizeArgs(args);
            let [ normStmt, normArgs ] = DBI.arrayify(stmt, normedArgs, this._arrayifyOptions());
            this._inner.query(normStmt, normArgs, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }

    beginAsync() {
        // the idea here is???
        // issue begin
        // issue savepoint.
        let savePoint = this._savePointName();
        return super.beginAsync()
            .then(() => this.execAsync(`SAVEPOINT ${savePoint}`))
            .then(() => {
                this._transStack.push(savePoint)
            });
    }

    commitAsync() {
        if (this._transStack.isEmpty) {
            return Promise.reject(new Error(`NegativeTransCount`));
        }
        let savePoint = this._transStack.pop();
        let query = this._transStack.isEmpty ? 'commit' : `release savepoint ${savePoint}`;
        return this.execAsync(query)
    }

    rollbackAsync() {
        if (this._transStack.isEmpty) {
            return Promise.reject(new Error(`NegativeTransCount`));
        }
        let savePoint = this._transStack.pop();
        let query = this._transStack.isEmpty ? 'rollback' : `rollback to savepoint ${savePoint}`;
        return this.execAsync(query)
    }

    private _savePointName() {
        let savePoint = `sp_${this.id}_${this._transStack.size}`;
        return savePoint;
    }

    private _normalizeArgs(args : DBI.QueryArgs) : DBI.QueryArgs {
        return Object.keys(args).reduce((acc, key) => {
            if (args[key] instanceof Date) {
                acc[key] = (args[key] as Date).toISOString();
            } else if (args[key] instanceof Object) {
                acc[key] = JSON.stringify(args[key]);
            } else {
                acc[key] = args[key];
            }
            return acc;
        }, {} as DBI.QueryArgs);
    }

    private _arrayifyOptions() : DBI.ArrayifyOptions {
        let _counter = 0;
        let keyGen = () => {
            _counter++;
            return `$${_counter}`;
        }
        return {
            key: keyGen,
            merge: false
        }
    }

    disconnectAsync() : Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._inner.end((err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            });
        })
    }

}

DBI.register('pg', PostgresDriver);
