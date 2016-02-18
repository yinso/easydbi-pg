#!/usr/bin/env coffee # -*- coffee-script -*- -p
DBI = require 'easydbi'
driver = require '../src/driver'
{ assert } = require 'chai'
loglet = require 'loglet'
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
    loglet.debug 'isConnected', db.isConnected()
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
              conn.insertTestAsync({c1: 2, c2: 4})
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

