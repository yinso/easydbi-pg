#!/usr/bin/env coffee # -*- coffee-script -*- -p
DBI = require 'easydbi'
driver = require '../src/driver'
{ assert } = require 'chai'
debug = require('debug')('test:driver')
Promise = require 'bluebird'

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
    try
      DBI.connect 'test1', (err, conn) ->
        conn.isConnected()
        if err
          done err
        else
          db = conn
          done null
    catch e
      done e

  it 'can create/insert/select', (done) ->
    debug 'isConnected', db.isConnected()
    db.execAsync('insert into test_t values ($c1, $c2)', {c1: 1, c2: 2})
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
      DBI.connectAsync('test1')
        .then (conn) ->
          conn.beginAsync()
            .then ->
              conn.insertTestAsync({c1: conn.id, c2: 4})
            .then ->
              conn.selectTestAsync {}
            .then (rows) ->
              conn.commitAsync()
                .then ->
                  conn.disconnectAsync()
                  rows
    Promise.map([1, 2, 3, 4, 5, 6, 7], helper)
      .then (allRows) ->
        console.log 'all rows', allRows
        done null
      .catch done

  it 'can handle nested transactions (fully unroll)', (done) ->
    inner = (cb) ->
      db.beginAsync()
        .then ->
          db.insertTestAsync {c1: 10, c2: 11}
        .then ->
          db.commit () ->
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
