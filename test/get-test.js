'use strict'

const isBuffer = require('is-buffer')
const { verifyNotFoundError, isTypedArray, illegalKeys, assertAsync } = require('./util')

let db

exports.setUp = function (test, testCommon) {
  test('setUp common', testCommon.setUp)
  test('setUp db', function (t) {
    db = testCommon.factory()
    db.open(t.end.bind(t))
  })
}

exports.args = function (test, testCommon) {
  test('test get() with illegal keys', assertAsync.ctx(function (t) {
    t.plan(illegalKeys.length * 6)

    for (const { name, key, regex } of illegalKeys) {
      db.get(key, assertAsync(function (err) {
        t.ok(err, name + ' - has error (callback)')
        t.ok(err instanceof Error, name + ' - is Error (callback)')
        t.ok(err.message.match(regex), name + ' - correct error message (callback)')
      }))

      db.get(key).catch(function (err) {
        t.ok(err instanceof Error, name + ' - is Error (promise)')
        t.ok(err.message.match(regex), name + ' - correct error message (promise)')
      })
    }
  }))
}

exports.get = function (test, testCommon) {
  test('test simple get()', function (t) {
    db.put('foo', 'bar', function (err) {
      t.error(err)
      db.get('foo', function (err, value) {
        t.error(err)

        let result

        if (!testCommon.encodings) {
          t.isNot(typeof value, 'string', 'should not be string by default')

          if (isTypedArray(value)) {
            result = String.fromCharCode.apply(null, new Uint16Array(value))
          } else {
            t.ok(isBuffer(value))
            try {
              result = value.toString()
            } catch (e) {
              t.error(e, 'should not throw when converting value to a string')
            }
          }
        } else {
          result = value
        }

        t.is(result, 'bar')

        db.get('foo', {}, function (err, value) { // same but with {}
          t.error(err)

          let result

          if (!testCommon.encodings) {
            t.ok(typeof value !== 'string', 'should not be string by default')

            if (isTypedArray(value)) {
              result = String.fromCharCode.apply(null, new Uint16Array(value))
            } else {
              t.ok(isBuffer(value))
              try {
                result = value.toString()
              } catch (e) {
                t.error(e, 'should not throw when converting value to a string')
              }
            }
          } else {
            result = value
          }

          t.is(result, 'bar')

          db.get('foo', { asBuffer: false }, function (err, value) {
            t.error(err)
            t.ok(typeof value === 'string', 'should be string if not buffer')
            t.is(value, 'bar')
            t.end()
          })
        })
      })
    })
  })

  test('test get() with promise', function (t) {
    db.put('promises', 'yes', function (err) {
      t.error(err)

      db.get('promises').then(function (value) {
        t.is(value.toString(), 'yes', 'got value without options')

        db.get('not found').catch(function (err) {
          t.ok(err, 'should error')
          t.ok(verifyNotFoundError(err), 'should have correct error message')

          const opts = testCommon.encodings ? { valueEncoding: 'utf8' } : { asBuffer: false }

          db.get('promises', opts).then(function (value) {
            t.is(value, 'yes', 'got value with string options')
            t.end()
          }).catch(t.fail.bind(t))
        })
      }).catch(t.fail.bind(t))
    })
  })

  test('test simultaneous get()', function (t) {
    db.put('hello', 'world', function (err) {
      t.error(err)
      let completed = 0
      const done = function () {
        if (++completed === 20) t.end()
      }

      for (let i = 0; i < 10; ++i) {
        db.get('hello', function (err, value) {
          t.error(err)
          t.is(value.toString(), 'world')
          done()
        })
      }

      for (let i = 0; i < 10; ++i) {
        db.get('not found', function (err, value) {
          t.ok(err, 'should error')
          t.ok(verifyNotFoundError(err), 'should have correct error message')
          t.ok(typeof value === 'undefined', 'value is undefined')
          done()
        })
      }
    })
  })

  test('test get() not found error is asynchronous', function (t) {
    t.plan(4)

    let async = false

    db.get('not found', function (err, value) {
      t.ok(err, 'should error')
      t.ok(verifyNotFoundError(err), 'should have correct error message')
      t.ok(typeof value === 'undefined', 'value is undefined')
      t.ok(async, 'callback is asynchronous')
    })

    async = true
  })
}

exports.tearDown = function (test, testCommon) {
  test('tearDown', function (t) {
    db.close(testCommon.tearDown.bind(null, t))
  })
}

exports.all = function (test, testCommon) {
  exports.setUp(test, testCommon)
  exports.args(test, testCommon)
  exports.get(test, testCommon)
  exports.tearDown(test, testCommon)
}
