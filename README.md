# EasyDBI-Pg - Postgres Database Adapter for EasyDBI

[`EasyDBI`](http://github.com/yinso/easydbi) is a simple database interface for NodeJS. `easydbi-pg` is the postgresql database adapter for `easydbi`.

# Installation

    npm install easydbi
    npm install easydbi-pg

# Usage

See [`EasyDBI`](http://github.com/yinso/easydbi) for more details on the API.

    var DBI = require('easydbi'); // already comes with sqlite3
    require('easydbi-pg'); // for pg
    
    DBI.setup('test', {type: 'pg', options: {database: 'test', user: 'test', password: 'test', host: 'localhost', port: 5432})
    
    // "prepare" queries. 
    DBI.prepare('test', 'createTest', {exec: 'create table test_t (c1 int, c2 int)'});
    
    DBI.connect('test', function(err, conn) { /* ... */ });
