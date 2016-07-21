
pg = require 'pg'
DBI = require 'easydbi'
debug = require('debug')('easydbi-pg')
Errorlet = require 'errorlet'
Promise = require('bluebird')

Promise.promisifyAll pg.Client.prototype

class PostgresDriver extends DBI.Driver
  @pool = false
  @id = 0
  constructor: (@key, @options) ->
    super @key, @options
    @connstr = @makeConnStr @options
    @type = 'pg'
    @transStack = 0
    @transStack = []
  makeConnStr: (options) ->
    options
  innerConnect: (cb) ->
    debug "PostgresDriver.connect", @options
    self = @
    @inner = new pg.Client @connstr
    @inner.connect (err) =>
      if err
        cb err
      else
        debug 'PostgresDriver.connect:OK', self.id
        cb null, self
  innerIsConnected: () ->
    val = @inner instanceof pg.Client
    debug "PostgresDriver.isConnected", @inner instanceof pg.Client
    val
  normalizeArguments: (args) ->
    normedArgs = {}
    for key, arg of args
      if arg instanceof Object
        normedArgs[key] = JSON.stringify arg
      else
        normedArgs[key] = arg
    normedArgs
  innerQuery: (key, args, cb) ->
    debug 'PostgresDriver.query', JSON.stringify(key), args
    try
      i = 0
      keyGen = () ->
        i = i + 1
        "$#{i}"
      [ key, args ] = DBI.queryHelper.arrayify key, @normalizeArguments(args), {key: keyGen}
      @_query key, args, cb
    catch e
      cb e
  _query: (stmt, args, cb) ->
    @inner.query stmt, args, (err, result) =>
      if err
        debug("PostgresDriver._query:ERROR, %s", err.stack)
        cb err
      else if result.rows instanceof Array and stmt.match /^\s*select/i
        cb null, result.rows
      else
        cb null
  savePointName: () ->
    "sp_#{@id}_#{@transStack.length}"
  innerBegin: (cb) ->
    savePoint = null
    @inner.queryAsync 'begin'
      .then () =>
        if @transStack.length > 0
          savePoint = @savePointName()
          return @inner.queryAsync "SAVEPOINT #{savePoint}"
        else
          return
      .then () =>
        @transStack.push savePoint
        cb null
      .catch (e) =>
        cb e
  innerCommit: (cb) ->
    if @transStack.length == 0
      return cb new Errorlet({
        error: 'negative_transcount',
        method: 'PostgresDriver.commit'
      })
    savePoint = @transStack.pop()
    query =
      if @transStack.length == 0
        "commit"
      else
        "release savepoint #{savePoint}"
    @inner.queryAsync query
      .then () ->
        cb null
      .catch cb
  innerRollback: (cb) ->
    if @transStack.length == 0
      return cb new Errorlet({
        error: 'negative_transcount',
        method: 'PostgresDriver.commit'
      })
    savePoint = @transStack.pop()
    query =
      if @transStack.length == 0
        "rollback"
      else
        "rollback to savepoint #{savePoint}"
    @inner.queryAsync query
      .then () ->
        cb null
      .catch cb
  innerDisconnect: (cb) ->
      try
        #loglet.log 'easydbi.pg.disconnect'
        @inner.end()
        cb null
      catch e
        cb e
  innerClose: (cb) ->
      try
        #loglet.log 'easydbi.pg.close'
        @inner.end()
        cb null
      catch e
        cb e

DBI.register 'pg', PostgresDriver

module.exports = PostgresDriver
