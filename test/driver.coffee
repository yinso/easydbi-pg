#!/usr/bin/env coffee # -*- coffee-script -*- -p
DBI = require 'easydbi'
driver = require '../src/driver'
{ assert } = require 'chai'
debug = require('debug')('test:driver')
Promise = require 'bluebird'
AppError = require 'errorlet'

describe 'pg driver test', () ->

  db = null

  it 'can setup', (done) ->
    try
      DBI.setup 'test1', {type: 'pg', options: {database: 'test', user: 'test', password: 'testPass1'}}
      done null
    catch e
      done e

  it 'can prepare', (done) ->
    try
      DBI.load 'test1',
        insertTest:
          exec: 'insert into test_t values ($c1, $c2)'
        selectTest:
          query: 'select * from test_t'
      done null
    catch e
      done e

  it 'can connect', (done) ->
    DBI.connect 'test1'
      .then (conn) ->
        assert.equal conn.isConnected(), true
        assert.throws ->
          conn.isConnected(true)
        db = conn
      .then () ->
        done null
      .catch done

  it 'can create/insert/select', (done) ->
    debug 'isConnected', db.isConnected()
    db.exec('insert into test_t values ($c1, $c2)', {c1: 1, c2: 2})
      .then ->
        db.insertTestAsync {c1: 3, c2: 4}
      .then ->
        db.selectTestAsync {}
      .then (rows) ->
        done null
      .catch (e) ->
        done e

  it 'can have concurrent connections', (done) ->
    helper = (count) ->
      DBI.connect('test1')
        .then (conn) ->
          conn.begin()
            .then ->
              conn.insertTestAsync({c1: conn.id, c2: 4})
            .then ->
              conn.selectTestAsync {}
            .then (rows) ->
              conn.commit()
                .then ->
                  conn.disconnect()
                  rows
    Promise.map([1, 2, 3, 4, 5, 6, 7], helper)
      .then (allRows) ->
        console.log 'all rows', allRows
        done null
      .catch done

  it 'can handle nested transactions (fully unroll)', (done) ->
    inner = (cb) ->
      db.begin()
        .then ->
          db.insertTestAsync {c1: 10, c2: 11}
        .then ->
          db.commit()
        .then () ->
          console.log("INNER COMMIT")
          cb null
        .catch (e) ->
          console.log("TRANS ERROR #{e}")
          db.rollback () ->
            console.log("INNER ROLLBACK")
            cb e
    innerAsync = Promise.promisify inner
    outer = (cb) ->
      db.beginAsync()
        .then ->
          db.insertTestAsync {c1: 10, c2: 22}
        .then ->
          innerAsync()
        .then ->
          throw new Error("ROLL ME BACK")
        .then ->
          db.commit () ->
            console.log("OUTER COMMIT")
            cb null
        .catch (e) ->
          console.log("TRANS ERROR #{e}")
          db.rollback () ->
            console.log("OUTER ROLLBACK")
            cb e
    outerAsync = Promise.promisify outer
    outerAsync()
      .then () ->
        done new Error("nested trans should have failed")
      .catch (e) ->
        db.queryAsync('select * from test_t where c1 = $c1', {c1: 10})
          .then (rows) ->
            if rows.length > 0
              console.log('c1 == 10', rows)
              db.execAsync('delete from test_t where c1 = $c1', {c1: 10})
                .then () ->
                  done new Error("There should not have been rows where c1 == 10")
            else
              done null
          .catch (e) ->
            done e

  it 'should clean up', (done) ->
    db.execAsync 'delete from test_t'
      .then () ->
        done()
      .catch (e) ->
        done(e)

  it 'test schema issues', (done) ->
    try
      db.query {foo: 1, bar: 2}
        .then (recs) ->
          done new AppError
            error: 'UnexpectedSuccess'
            message: 'should have failed instead'
        .catch (e) ->
          console.error 'Expected error', e.stack
          done null
    catch e
      done e

  it 'can handle jsonb correctly', (done) ->
    phones1 = []
    phones2 = [
      {
        phone: '123-467-8609'
        phoneType: 'mobile'
      }
    ]
    db.beginAsync()
      .then () ->
        db.execAsync 'create table test_json (phones jsonb)'
      .then () ->
        db.execAsync 'insert into test_json values ($phones)', phones: phones1
      .then () ->
        db.execAsync 'insert into test_json values ($phones)', phones: phones2
      .then () ->
        db.queryAsync('select * from test_json')
          .then (rows) ->
            assert.equal rows.length, 2
            assert.deepEqual rows[0], { phones: phones1 }
            assert.deepEqual rows[1], { phones: phones2 }
            return
      .then () ->
        db.execAsync 'drop table test_json'
      .then () ->
        db.commitAsync()
      .then () ->
        done()
      .catch (e) ->
        db.rollback () ->
          done e


