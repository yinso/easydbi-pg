#!/usr/bin/env coffee # -*- coffee-script -*- -p
DBI = require 'easydbi'
driver = require '../src/driver'
funclet = require 'funclet'
assert = require 'assert'
loglet = require 'loglet'
async = require 'async'

describe 'firebird driver test', () ->
  
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
    funclet
      .start (cb) ->
        loglet.debug 'isConnected', db.isConnected()
        db.exec 'insert into test_t values ($c1, $c2)', {c1: 1, c2: 2}, cb
      .then (cb) ->
        db.insertTest {c1: 3, c2: 4}, cb
      .then (cb) ->
        db.selectTest {}, cb
      .then (rows, cb) ->
        try 
          #assert.deepEqual rows, [{c1: 1, c2: 2}, {c1: 3, c2: 4}]
          cb null 
        catch e
          cb e
      .catch (err) ->
        done err
      .done () ->
        done null
  
  it 'can have concurrent connections', (done) ->
    helper = (count, next) ->
      conn = null
      funclet
        .start (cb) ->
          DBI.connect 'test1', (err, c) ->
            if err
              cb err
            else
              conn = c
              cb null
        .then (cb) ->
          conn.insertTest {c1: 2, c2: 4}, cb
        .then (cb) ->
          conn.selectTest {}, cb
        .then (rows, cb) ->
          conn.commit cb
        .catch (err) ->
          conn.disconnect (e) ->
            loglet.debug 'conn.disconnect'
            next e
        .done () ->
          conn.disconnect (e) -> 
            loglet.debug 'conn.disconnect'
            next e
    list = [1, 2, 3, 4, 5, 6, 7]
    async.each list, helper, (err) ->
      loglet.debug 'async.last', err
      if err
        done err
      else
        funclet
          .start (cb) ->
            db.selectTest {}, cb
          .then (rows, cb) ->
            try
              console.log 'rows', rows
              #assert.equal rows.length, list.length + 2
              cb null
            catch e
              cb e
          .catch(done)
          .done(done)
    
