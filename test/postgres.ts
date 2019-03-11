import * as DBI from 'easydbi';
import * as Promise from 'bluebird';
import { suite , test , timeout } from 'mocha-typescript';
import * as assert from 'assert';
import '../lib/postgres';

let driver : DBI.Driver;
let setupName = 'test-pg';
let options : DBI.DriverOptions = {
    // https://www.postgresql.org/docs/current/libpq-envars.html
    database: process.env['PGDATABASE'] || 'postgres',
    user: process.env['PGUSER'] || 'postgres',
    password: process.env['PGPASSWORD'] || 'postgres',
    host: process.env['PGHOST'] || 'localhost',
    port: process.env['PGPORT'] || 5432,
    pool: {
        min: 2,
        max: 5
    }
}

@suite
class PostgresDriverTest {
    @test canSetup() {
        DBI.setup(setupName, {
            type: 'pg',
            options: options,
        });
    }

    @test canConnect() {
        return DBI.connectAsync(setupName)
            .then((conn) => {
                driver = conn;
            })
    }

    @test canCreateTable() {
        return driver.execAsync('create table test_t (c1 int, c2 int)');        
    }

    @test canInsert() {
        return driver.execAsync('insert into test_t values ($c1, $c2)', { c1 : 1, c2 : 2})
    }

    @test canSelect() {
        return driver.queryAsync('select * from test_t where c1 = $c1', { c1 : 1 })
            .then((rows) => assert.deepEqual([{ c1 : 1, c2 : 2 }], rows))
    }

    @test canInsertAgain() {
        return driver.execAsync('insert into test_t values ($c1, $c2)', { c1 : 2, c2 : 3})
    }

    @test canConcurrentConnect() {
        let helper = (count: number) => {
            return DBI.connectAsync(setupName)
                .then((conn) => {
                    return conn.beginAsync()
                        .then(() => conn.execAsync('insert into test_t values ($c1, $c2)', { c1 : conn.id + 10, c2: 4}))
                        .then(() => conn.queryAsync('select * from test_t where c1 = $c1', { c1 : conn.id + 10}))
                        .then((rows) => assert.deepEqual([{ c1: conn.id + 10, c2 : 4}], rows))
                        .then(() => conn.rollbackAsync())
                        .then(() => conn.disconnectAsync())
                })
        }
        return Promise.map([1, 2, 3, 4, 5, 6, 7, 8], helper)
    }

    @test canDropTable() {
        return driver.execAsync('drop table test_t');        
    }

    @test canHandleJsonb() {
        let phones = [
            {
                phone: '123-456-7890',
                type: 'mobile'
            },
            {
                phone: '234-567-8901',
                type: 'home'
            }
        ]
        return DBI.connectAsync(setupName)
            .then((conn) => {
                return conn.beginAsync()
                    .then(() => conn.execAsync('create table test_phones (phones jsonb)'))
                    .then(() => conn.execAsync('insert into test_phones (phones) values ($phones::jsonb)', { phones }))
                    .then(() => conn.queryAsync('select * from test_phones'))
                    .then((rows) => assert.deepEqual(rows, [ { phones} ] ))
                    .then(() => conn.rollbackAsync())
                    .then(() => conn.disconnectAsync())
            })
    }


    @test canDoNestedTransaction() {
        // how to prove nested transaction works.
        // begin -- outer trans
        //   begin -- inner trans1
        //   commit -- saved
        //   begin -- inner trans2
        //   rollback -- not saved
        //   begin  -- inner trans3
        //   commit -- saved
        // verify
        // rollback
        // there should only be data based on the first two inner trans.

        function innerHelper(conn : DBI.Driver, values : { c1 : number, c2 : number},  toRollback : boolean = false) {
            return conn.beginAsync()
                .then(() => conn.execAsync('insert into test_t values ($c1, $c2)', values))
                .then(() => {
                    if (toRollback) {
                        throw new Error(`ExplicitRollback`)
                    }
                })
                .then(() => conn.commitAsync())
                .catch((e) => {
                    return conn.rollbackAsync()
                        .then(() => {
                            if (!toRollback)
                                throw e
                        })
                })
        }

        let record = { c1 : 1, c2 : 1 }
        return driver.beginAsync()
            .then(() => driver.execAsync('create table test_t (c1 int, c2 int)'))
            .then(() => innerHelper(driver, record))
            .then(() => innerHelper(driver, record, true))
            .then(() => innerHelper(driver, record))
            .then(() => driver.queryAsync('select * from test_t '))
            .then((rows) => assert.deepEqual([ record , record ], rows))
            .then(() => driver.rollbackAsync().then(() => {}))
            .catch((e) => {
                return driver.rollbackAsync()
                    .then(() => {
                        throw e
                    })
            })
    }

    @test canDisconnect() {
        return driver.disconnectAsync()
    }
}
