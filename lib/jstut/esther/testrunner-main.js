/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Messaging Code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 * A web runner for jetpack style unit tests (which may in turn conform to some
 *  other testing standard, but jetpack is all we need to conform to).  You
 *  point us at a package name and we find all the tests in the "tests"
 *  directory of the package and then dynamically load and run them.
 **/

define("jstut/esther/testrunner-main",
  [
    "narscribblus/utils/pwomise",
    "narscribblus/docfusion",
    "jstut-plat/utils/env",
    "./testrunner-ui",
    "./unit-test2",
    "exports"
  ],
  function(
    $pwomise,
    $docfusion,
    $env,
    $ui_runner,
    $runner,
    exports
  ) {

var when = $pwomise.when;
var docFusion = new $docfusion.DocFusion();

/**
 * Stores generic information about a test file in addition to summary
 *  statistics and the details of the actual run.
 */
function TestFileState(pkg, filename) {
  this.pkg = pkg;
  this.name = filename;
  this.state = "notloaded";

  this.testsKnown = 0;
  this.testsPassed = 0;
  this.testsFailed = 0;
  this.testsSkipped = 0;

  this.testRuns = null;
}
TestFileState.prototype = {
  chewResults: function(summary) {
    for (var i = 0; i < summary.length; i++) {
      var run = summary[i];
      this.testsKnown++;
      if (run.failed)
        this.testsFailed++;
      else if (run.passed)
        this.testsPassed++;
      else
        this.testsSkipped++;
    }
    if (this.testsFailed)
      this.state = "failed";
    else if (this.testsPassed)
      this.state = "passed";
    else
      this.state = "skipped";

    this.testRuns = summary;
  },
};

/**
 * The wmsy coupling of the TestDriver so we can also run without realtime
 *  UI updates of a bound UI slowing us down.
 */
function WmsyFronter(doc) {
  this.doc = doc;
  this.binder = null;
  this.driver = null;
  this.driverBinding = null;
  this.idSpace = null;
}
WmsyFronter.prototype = {
  bind: function(driver) {
    this.driver = driver;

    var body = this.doc.getElementsByTagName("body")[0];
    this.binder = $ui_runner.wy.wrapElement(body);
    this.driverBinding = this.binder.bind({type: "test-driver", obj: driver});

    this.idSpace = this.binder.idSpace;
  },

  updateDriver: function() {
    this.driverBinding.update();
  },

  updateTestFile: function(testFile) {
    this.idSpace.updateUsingObject("test-file", testFile);
  },

  /**
   * Tell the driver binding we are done running tests so it can decide to
   *  expand test file details for reasons like only having a single test file.
   */
  doneRunningTests: function() {
    this.driverBinding.doneRunningTests();
  },

  updateLocationParam: function() {
    var cur = $env.getEnv();
    for (var i = 0; i + 1< arguments.length; i += 2) {
      var key = arguments[i];
      var val = arguments[i + 1];
      if (val == null)
        delete cur[key];
      else
        cur[key] = val.toString();
    }
    var newSpec = $env.buildSearchSpec(cur);
    var win = this.doc.defaultView;
    if (win.location.search != newSpec)
      win.location.search = newSpec;
  },
};

/**
 * Drives the actual tests.
 *
 * @args[
 *   @param[fronter WmsyFronter]{
 *     UI hook-up.
 *   }
 *   @param[testFileFilter #:optional @func[
 *     @args[
 *       @param[testFileName String]
 *     ]
 *     @return[Boolean]{
 *       True if we should process the file for tests, false if not.
 *     }
 *   ]]
 * ]
 */
function TestDriver(fronter, testFileFilter) {
  this.fronter = fronter;
  this.testFileFilter = testFileFilter;

  this.pkg = null;
  this.files = [];
}
TestDriver.prototype = {
  /**
   * To be invoked when docfusion has finished bootstrapping our package.
   *
   * (We allow ourselves to be created without posessing this information so
   *  that the UI can be hooked up before the asynchronous bootstrap process
   *  completes.)
   */
  packageForYou: function(pkg) {
    this.pkg = pkg;

    var testFileFilter = this.testFileFilter;
    for (var i = 0; i < pkg.testFiles.length; i++) {
      if (testFileFilter && !(testFileFilter(pkg.testFiles[i])))
        continue;
      this.files.push(
        new TestFileState(pkg, pkg.testFiles[i].name.slice(0, -3)));
    }

    this.fronter.updateDriver();
  },

  /**
   * Require a test file, scan it for tests, initiate execution of the tests.
   *
   * Each test file gets its own instance of the jetpack-style TestRunner.  If
   *  a framework is defined, its wrapper is invoked for each test function.
   */
  _runTestFile: function _runTestFile(testFile, doneFunc) {
    var testModName = testFile.pkg.name + "-tests/" + testFile.name;
    var runner = new $runner.TestRunner();

    // XXX handle requireJS trouble:
    //  - expected failure case: illegal syntax
    //  - unexpected failure case: file no longer there
    require([testModName], function(testMod) {
      var tests = [];

      // Tests are allowed to specify a framework they use by exporting the
      //  module under a __framework attribute.  The module must in turn
      //  export a "wrapTest" function.
      var handleWrapper = null;
      if (("__framework" in testMod) && testMod.__framework)
        handleWrapper = testMod.__framework.wrapTest;

      for (var name in testMod) {
        // ignore things prefixed with underscores
        if (name[0] == "_")
          continue;

        // unit-test used to actually wrap the test functions with some
        //  logging.
        tests.push({
          name: name,
          testFunction: testMod[name],
          wrapperMaker: handleWrapper,
        });
      }

      runner.startMany({
        tests: tests,
        onDone: function() {
          testFile.chewResults(runner.testRunSummary);
          doneFunc();
        },
      });
    });
  },

  /**
   * Initiate the process of running all the known test files.
   */
  runTestFiles: function(soloTestFileName) {
    if (this.files.length === 0) {
      console.warn("no test files found, nothing to run!");
      return;
    }

    var self = this, iTestFile = 0;
    function runNext() {
      self.fronter.updateTestFile(self.files[iTestFile++]);
      if (iTestFile === self.files.length) {
        console.info("all done running tests");
        self.fronter.doneRunningTests();
        return;
      }
      self._runTestFile(self.files[iTestFile], runNext);
    }
    self._runTestFile(self.files[0], runNext);
  },
};

exports.main = function main(doc) {
  var env = $env.getEnv();

  if (!("pkg" in env))
    throw new Error("package name not specified; we should fail to usage");
  var testFileFilter;
  if ("solo" in env) {
    var testFileName = env.solo + ".js";
    testFileFilter = function(f) {
      return f.name === testFileName;
    };
  }
  var pkgName = env.pkg;

  var fronter = new WmsyFronter(doc);
  var runner = new TestDriver(fronter, testFileFilter);

  // -- bind the UI in and convey the current state
  fronter.bind(runner);

  when(docFusion.getPackage(pkgName, {types: false, testFiles: true}),
       function(pkg) {
    console.log("got package");
    runner.packageForYou(pkg);
    runner.runTestFiles();
  });
};

}); // end define
