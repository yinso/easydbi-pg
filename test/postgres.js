"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var DBI = require("easydbi");
var Promise = require("bluebird");
var mocha_typescript_1 = require("mocha-typescript");
var assert = require("assert");
require("../lib/postgres");
var driver;
var setupName = 'test-pg';
var options = {
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
};
var PostgresDriverTest = /** @class */ (function () {
    function PostgresDriverTest() {
    }
    PostgresDriverTest.prototype.canSetup = function () {
        DBI.setup(setupName, {
            type: 'pg',
            options: options,
        });
    };
    PostgresDriverTest.prototype.canConnect = function () {
        return DBI.connectAsync(setupName)
            .then(function (conn) {
            driver = conn;
        });
    };
    PostgresDriverTest.prototype.canCreateTable = function () {
        return driver.execAsync('create table test_t (c1 int, c2 int)');
    };
    PostgresDriverTest.prototype.canInsert = function () {
        return driver.execAsync('insert into test_t values ($c1, $c2)', { c1: 1, c2: 2 });
    };
    PostgresDriverTest.prototype.canSelect = function () {
        return driver.queryAsync('select * from test_t where c1 = $c1', { c1: 1 })
            .then(function (rows) { return assert.deepEqual([{ c1: 1, c2: 2 }], rows); });
    };
    PostgresDriverTest.prototype.canInsertAgain = function () {
        return driver.execAsync('insert into test_t values ($c1, $c2)', { c1: 2, c2: 3 });
    };
    PostgresDriverTest.prototype.canConcurrentConnect = function () {
        var helper = function (count) {
            return DBI.connectAsync(setupName)
                .then(function (conn) {
                return conn.beginAsync()
                    .then(function () { return conn.execAsync('insert into test_t values ($c1, $c2)', { c1: conn.id + 10, c2: 4 }); })
                    .then(function () { return conn.queryAsync('select * from test_t where c1 = $c1', { c1: conn.id + 10 }); })
                    .then(function (rows) { return assert.deepEqual([{ c1: conn.id + 10, c2: 4 }], rows); })
                    .then(function () { return conn.rollbackAsync(); })
                    .then(function () { return conn.disconnectAsync(); });
            });
        };
        return Promise.map([1, 2, 3, 4, 5, 6, 7, 8], helper);
    };
    PostgresDriverTest.prototype.canDropTable = function () {
        return driver.execAsync('drop table test_t');
    };
    PostgresDriverTest.prototype.canHandleJsonb = function () {
        var phones = [
            {
                phone: '123-456-7890',
                type: 'mobile'
            },
            {
                phone: '234-567-8901',
                type: 'home'
            }
        ];
        return DBI.connectAsync(setupName)
            .then(function (conn) {
            return conn.beginAsync()
                .then(function () { return conn.execAsync('create table test_phones (phones jsonb)'); })
                .then(function () { return conn.execAsync('insert into test_phones (phones) values ($phones::jsonb)', { phones: phones }); })
                .then(function () { return conn.queryAsync('select * from test_phones'); })
                .then(function (rows) { return assert.deepEqual(rows, [{ phones: phones }]); })
                .then(function () { return conn.rollbackAsync(); })
                .then(function () { return conn.disconnectAsync(); });
        });
    };
    PostgresDriverTest.prototype.canDoNestedTransaction = function () {
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
        function innerHelper(conn, values, toRollback) {
            if (toRollback === void 0) { toRollback = false; }
            return conn.beginAsync()
                .then(function () { return conn.execAsync('insert into test_t values ($c1, $c2)', values); })
                .then(function () {
                if (toRollback) {
                    throw new Error("ExplicitRollback");
                }
            })
                .then(function () { return conn.commitAsync(); })
                .catch(function (e) {
                return conn.rollbackAsync()
                    .then(function () {
                    if (!toRollback)
                        throw e;
                });
            });
        }
        var record = { c1: 1, c2: 1 };
        return driver.beginAsync()
            .then(function () { return driver.execAsync('create table test_t (c1 int, c2 int)'); })
            .then(function () { return innerHelper(driver, record); })
            .then(function () { return innerHelper(driver, record, true); })
            .then(function () { return innerHelper(driver, record); })
            .then(function () { return driver.queryAsync('select * from test_t '); })
            .then(function (rows) { return assert.deepEqual([record, record], rows); })
            .then(function () { return driver.rollbackAsync().then(function () { }); })
            .catch(function (e) {
            return driver.rollbackAsync()
                .then(function () {
                throw e;
            });
        });
    };
    PostgresDriverTest.prototype.canDisconnect = function () {
        return driver.disconnectAsync();
    };
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canSetup", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canConnect", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canCreateTable", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canInsert", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canSelect", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canInsertAgain", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canConcurrentConnect", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canDropTable", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canHandleJsonb", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canDoNestedTransaction", null);
    __decorate([
        mocha_typescript_1.test,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PostgresDriverTest.prototype, "canDisconnect", null);
    PostgresDriverTest = __decorate([
        mocha_typescript_1.suite
    ], PostgresDriverTest);
    return PostgresDriverTest;
}());
//# sourceMappingURL=postgres.js.map