
pg = require 'pg'
DBI = require 'easydbi'
loglet = require 'loglet'

class PostgresDriver extends DBI.Driver
  @pool = false
  @id = 0
  constructor: (@options) ->
    super @options
    @connstr = @makeConnStr @options
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
    loglet.debug "PostgresDriver._query", stmt, args
    @inner.query stmt, args, (err, result) =>
      if err
        cb err
      else if stmt.match /^select/i
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
    @inner.query 'BEGIN', cb
  commit: (cb) ->
    @inner.query 'COMMIT', cb
  rollback: (cb) ->
    @inner.query 'ROLLBACK', cb
  disconnect: (cb) ->
    try 
      @inner.end()
      cb null 
    catch e
      cb e
  close: (cb) ->
    try 
      @inner.end()
      cb null 
    catch e
      cb e

DBI.register 'pg', PostgresDriver

module.exports = PostgresDriver
