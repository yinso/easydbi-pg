"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var Promise = require("bluebird");
var pg = require("pg");
var DBI = require("easydbi");
var defaultPostgresOptions = {
    host: 'localhost',
    port: 5432,
};
function isPostgresOptions(v) {
    return DBI.isDriverOptions(v) && (v.memory ? typeof (v.memory) === 'boolean' : true) && (v.filePath ? typeof (v.filePath) === 'string' : true);
}
exports.isPostgresOptions = isPostgresOptions;
var Stack = /** @class */ (function () {
    function Stack() {
        this._inner = [];
    }
    Stack.prototype.push = function (item) {
        this._inner.push(item);
    };
    Object.defineProperty(Stack.prototype, "isEmpty", {
        get: function () {
            return this._inner.length === 0;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Stack.prototype, "size", {
        get: function () {
            return this._inner.length;
        },
        enumerable: true,
        configurable: true
    });
    Stack.prototype.pop = function () {
        var result = this._inner.pop();
        if (result === undefined) {
            throw new Error("StackUnderFlow");
        }
        return result;
    };
    return Stack;
}());
var PostgresDriver = /** @class */ (function (_super) {
    __extends(PostgresDriver, _super);
    function PostgresDriver(key, options) {
        var _this = _super.call(this, key, options) || this;
        _this._transStack = new Stack();
        if (isPostgresOptions(options)) {
            _this.connection = _this._normalizeOptions(options);
        }
        else {
            throw new Error("InvalidPostgresOptions");
        }
        return _this;
    }
    PostgresDriver.prototype._normalizeOptions = function (options) {
        return __assign({}, defaultPostgresOptions, options);
    };
    PostgresDriver.prototype.connectAsync = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._inner = new pg.Client(_this.connection);
            _this._inner.connect(function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(_this);
                }
            });
        });
    };
    PostgresDriver.prototype.isConnected = function () {
        return this._inner instanceof pg.Client;
    };
    PostgresDriver.prototype.queryAsync = function (stmt, args) {
        var _this = this;
        if (args === void 0) { args = {}; }
        return new Promise(function (resolve, reject) {
            var normedArgs = _this._normalizeArgs(args);
            var _a = DBI.arrayify(stmt, normedArgs, _this._arrayifyOptions()), normStmt = _a[0], normArgs = _a[1];
            _this._inner.query(normStmt, normArgs, function (err, result) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result.rows);
                }
            });
        });
    };
    PostgresDriver.prototype.execAsync = function (stmt, args) {
        var _this = this;
        if (args === void 0) { args = {}; }
        return new Promise(function (resolve, reject) {
            var normedArgs = _this._normalizeArgs(args);
            var _a = DBI.arrayify(stmt, normedArgs, _this._arrayifyOptions()), normStmt = _a[0], normArgs = _a[1];
            _this._inner.query(normStmt, normArgs, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    };
    PostgresDriver.prototype.beginAsync = function () {
        var _this = this;
        // the idea here is???
        // issue begin
        // issue savepoint.
        var savePoint = this._savePointName();
        return _super.prototype.beginAsync.call(this)
            .then(function () { return _this.execAsync("SAVEPOINT " + savePoint); })
            .then(function () {
            _this._transStack.push(savePoint);
        });
    };
    PostgresDriver.prototype.commitAsync = function () {
        if (this._transStack.isEmpty) {
            return Promise.reject(new Error("NegativeTransCount"));
        }
        var savePoint = this._transStack.pop();
        var query = this._transStack.isEmpty ? 'commit' : "release savepoint " + savePoint;
        return this.execAsync(query);
    };
    PostgresDriver.prototype.rollbackAsync = function () {
        if (this._transStack.isEmpty) {
            return Promise.reject(new Error("NegativeTransCount"));
        }
        var savePoint = this._transStack.pop();
        var query = this._transStack.isEmpty ? 'rollback' : "rollback to savepoint " + savePoint;
        return this.execAsync(query);
    };
    PostgresDriver.prototype._savePointName = function () {
        var savePoint = "sp_" + this.id + "_" + this._transStack.size;
        return savePoint;
    };
    PostgresDriver.prototype._normalizeArgs = function (args) {
        return Object.keys(args).reduce(function (acc, key) {
            if (args[key] instanceof Date) {
                acc[key] = args[key].toISOString();
            }
            else if (args[key] instanceof Object) {
                acc[key] = JSON.stringify(args[key]);
            }
            else {
                acc[key] = args[key];
            }
            return acc;
        }, {});
    };
    PostgresDriver.prototype._arrayifyOptions = function () {
        var _counter = 0;
        var keyGen = function () {
            _counter++;
            return "$" + _counter;
        };
        return {
            key: keyGen,
            merge: false
        };
    };
    PostgresDriver.prototype.disconnectAsync = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._inner.end(function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    };
    return PostgresDriver;
}(DBI.Driver));
exports.PostgresDriver = PostgresDriver;
DBI.register('pg', PostgresDriver);
//# sourceMappingURL=postgres.js.map