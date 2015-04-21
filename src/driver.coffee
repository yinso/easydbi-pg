
pg = require 'pg'
DBI = require 'easydbi'
loglet = require 'loglet'

class PostgresDriver extends DBI.Driver
  @pool = false
  @id = 0
  constructor: (@key, @options) ->
    super @key, @options
    @connstr = @makeConnStr @options
    @type = 'pg'
  makeConnStr: (options) ->
    options
  connect: (cb) ->
    loglet.debug "PostgresDriver.connect", @options
    self = @
    @inner = new pg.Client @connstr
    @inner.connect (err) =>
      if err
        cb err
      else
        loglet.debug 'PostgresDriver.connect:OK', self.id
        cb null, self
  isConnected: () ->
    val = @inner instanceof pg.Client
    loglet.debug "PostgresDriver.isConnected", @inner instanceof pg.Client
    val
  query: (key, args, cb) ->
    loglet.debug "PostgresDriver.query", key, args
    try 
      i = 0
      keyGen = () ->
        i = i + 1 
        "$#{i}"
      [ key, args ] = DBI.queryHelper.arrayify key, args, {key: keyGen}
      @_query key, args, cb
    catch e
      cb e
  _query: (stmt, args, cb) ->
    @inner.query stmt, args, (err, result) =>
      if err
        cb err
      else if result.rows instanceof Array and stmt.match /^\s*select/i
        cb null, result.rows
      else
        cb null
  exec: (key, args, cb) ->
    loglet.debug "PostgresDriver.exec", key, args
    if key == 'begin'
      @begin cb
    else if key == 'commit'
      @commit cb
    else if key == 'rollback'
      @rollback cb
    else
      try 
        i = 0
        keyGen = () ->
          i = i + 1 
          "$#{i}"
        [ key, args ] = DBI.queryHelper.arrayify key, args, {key: keyGen}
        @_query key, args, cb 
      catch e
        cb e
  begin: (cb) ->
    @inner.query 'BEGIN', (err, res) ->
      if err
        cb err
      else
        cb null
  commit: (cb) ->
    @inner.query 'COMMIT', (err, res) ->
      if err
        cb err
      else
        cb null
  rollback: (cb) ->
    @inner.query 'ROLLBACK', (err, res) ->
      if err
        cb err
      else
        cb null
  disconnect: (cb) ->
    try 
      loglet.log 'easydbi.pg.disconnect'
      @inner.end()
      cb null 
    catch e
      cb e
  close: (cb) ->
    try 
      loglet.log 'easydbi.pg.close'
      @inner.end()
      cb null 
    catch e
      cb e

DBI.register 'pg', PostgresDriver

module.exports = PostgresDriver
