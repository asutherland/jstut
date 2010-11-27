/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * This is Jetpack's unit-test that was modified to time each test run (and
 *  disable memory profiling), now converted to lose all the jetpack stuff
 *  entirely and devolve all responsibility for finding tests elsewhere.
 **/

require.def("jstut/esther/unit-test2", ["exports"], function(exports) {

function uneval(x) {
  return JSON.stringify(x);
}

var TestRunner = exports.TestRunner = function TestRunner(options) {
  this.passed = 0;
  this.failed = 0;
  this.testRunSummary = [];
};

TestRunner.prototype = {
  DEFAULT_PAUSE_TIMEOUT: 10000,

  _logTestFailed: function _logTestFailed(why) {
    this.test.errors[why]++;
    if (!this.testFailureLogged) {
      console.error("TEST FAILED: " + this.test.name + " (" + why + ")");
      this.testFailureLogged = true;
    }
  },

  pass: function pass(message) {
    console.info("pass:", message);
    this.passed++;
    this.test.passed++;
  },

  fail: function fail(message) {
    this._logTestFailed("failure");
    console.error("fail:", message);
    console.trace();
    this.failed++;
    this.test.failed++;
  },

  exception: function exception(e) {
    this._logTestFailed("exception");
    console.error(e); // XXX was console.exception...
    this.failed++;
    this.test.failed++;
  },

  assertMatches: function assertMatches(string, regexp, message) {
    if (regexp.test(string)) {
      if (!message)
        message = uneval(string) + " matches " + uneval(regexp);
      this.pass(message);
    } else {
      var no = uneval(string) + " doesn't match " + uneval(regexp);
      if (!message)
        message = no;
      else
        message = message + " (" + no + ")";
      this.fail(message);
    }
  },

  assertRaises: function assertRaises(func, predicate, message) {
    try {
      func();
      if (message)
        this.fail(message + " (no exception thrown)");
      else
        this.fail("function failed to throw exception");
    } catch (e) {
      var errorMessage;
      if (typeof(e) == "string")
        errorMessage = e;
      else
        errorMessage = e.message;
      if (typeof(predicate) == "object")
        this.assertMatches(errorMessage, predicate, message);
      else
        this.assertEqual(errorMessage, predicate, message);
    }
  },

  assert: function assert(a, message) {
    if (!a) {
      if (!message)
        message = "assertion failed, value is " + a;
      this.fail(message);
    } else
      this.pass(message || "assertion successful");
  },

  assertNotEqual: function assertNotEqual(a, b, message) {
    if (a != b) {
      if (!message)
        message = "a != b != " + uneval(a);
      this.pass(message);
    } else {
      var equality = uneval(a) + " == " + uneval(b);
      if (!message)
        message = equality;
      else
        message += " (" + equality + ")";
      this.fail(message);
    }
  },

  assertEqual: function assertEqual(a, b, message) {
    if (a == b) {
      if (!message)
        message = "a == b == " + uneval(a);
      this.pass(message);
    } else {
      var inequality = uneval(a) + " != " + uneval(b);
      if (!message)
        message = inequality;
      else
        message += " (" + inequality + ")";
      this.fail(message);
    }
  },

  done: function done() {
    if (!this.isDone) {
      this.isDone = true;
      var endedAt = Date.now();
      if (this.waitTimeout !== null) {
        clearTimeout(this.waitTimeout);
        this.waitTimeout = null;
      }
      if (this.test.passed == 0 && this.test.failed == 0) {
        this._logTestFailed("empty test");
        this.failed++;
        this.test.failed++;
      }

      if ("_targetExceptionsAt" in console)
        console._targetExceptionsAt(null);

      var errorList = [];
      for (var errorKey in this.test.errors) {
        errorList.push(errorKey);
      }

      this.testRunSummary.push({
        name: this.test.name,
        passed: this.test.passed,
        failed: this.test.failed,
        duration_ms: endedAt - this.startedAt,
        exceptions: this.test.exceptions,
        // converts from an object to a list...
        errors: errorList.join(", ")
      });

      if (this.onDone !== null) {
        var onDone = this.onDone;
        var self = this;
        this.onDone = null;
        setTimeout(function() { onDone(self); }, 0);
      }
    }
  },

  waitUntilDone: function waitUntilDone(ms) {
    if (ms === undefined)
      ms = this.DEFAULT_PAUSE_TIMEOUT;

    var self = this;

    function tiredOfWaiting() {
      self._logTestFailed("timed out");
      self.failed++;
      self.test.failed++;
      self.done();
    }

    this.waitTimeout = setTimeout(tiredOfWaiting, ms);
  },

  startMany: function startMany(options) {
    function runNextTest(self) {
      var test = options.tests.shift();
      if (test)
        self.start({test: test, onDone: runNextTest});
      else
        options.onDone(self);
    }
    runNextTest(this);
  },

  start: function start(options) {
    this.test = options.test;
    this.test.passed = 0;
    this.test.failed = 0;
    // create a list of exceptions and le
    this.test.exceptions = [];
    if ("_targetExceptionsAt" in console)
      console._targetExceptionsAt(this.test.exceptions);
    this.test.errors = {};

    this.isDone = false;
    this.onDone = options.onDone;
    this.waitTimeout = null;

    try {
      this.startedAt = Date.now();
      this.test.testFunction(this);
    } catch (e) {
      this.exception(e);
    }
    if (this.waitTimeout === null)
      this.done();
  }
};

}); // end require.def
