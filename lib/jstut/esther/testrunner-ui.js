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
 * Display a list of known test files and the state of the test file
 *  (not loaded, illegal syntax, legal syntax but not yet run, ran).  Test
 *  files that have been run show their result summaries and can be expanded
 *  for their delicious details.
 **/

define("jstut/esther/testrunner-ui",
  [
    "wmsy/wmsy",
    "./testresults-ui",
    "exports"
  ],
  function(
    $wmsy,
    $ui_results,
    exports
  ) {

var wy = exports.wy = new $wmsy.WmsyDomain({id: "testrunner-ui",
                                            domain: "esther",
                                            clickToFocus: true});

wy.defineStyleBase("files", [
  ".testFile {",
  "  border-radius: 6px;",
  "  border: 1px solid #444;",
  "  margin-bottom: 2px;",
  "}",
]);

wy.defineIdSpace("test-file", function(testFile) {
                   return testFile.pkg.name + "." + testFile.name;
                 });

wy.defineWidget({
  name: "test-driver",
  focus: wy.focus.domain.vertical("files"),
  constraint: {
    type: "test-driver",
  },
  structure: {
    files: wy.vertList({type: "test-file"}, "files"),
  },
  emit: ["expand"],
  receive: {
    soloFocus: function(testName) {
      var newVal;
      if (this.obj.testFileFilter)
        newVal = null;
      else
        newVal = testName;
      this.obj.fronter.updateLocationParam("solo", newVal);
    },
  },
  impl: {
    // if we have but a single test file then tell it to expand.
    doneRunningTests: function() {
      if (this.obj.files.length === 1) {
        this.emit_expand();
      }
    },
  },
});

wy.defineWidget({
  name: "test-file",
  doc: "Expandable summary of test results for a file.",
  focus: wy.focus.item,
  constraint: {
    type: "test-file",
  },
  idspaces: ["test-file"],
  structure: wy.block({
    header: {
      name: wy.bind("name"),
      toggleSolo: "solo",
    },
    tests: wy.vertList({type: "test-run"}, wy.NONE),
  }, {
    state: "state",
  }),
  impl: {
    preInit: function() {
      this.expanded = false;
    },
  },
  emit: ["soloFocus"],
  receive: {
    // our container may tell us to expand if we are the only one
    expand: function() {
      if (!this.expanded) {
        this.expanded = true;
        this.tests_set(this.obj.testRuns);
      }
    },
  },
  events: {
    root: {
      command: function() {
        if (this.expanded)
          this.tests_set([]);
        else
          this.tests_set(this.obj.testRuns);
        this.expanded = !this.expanded;
      }
    },
    toggleSolo: {
      command: function() {
        this.emit_soloFocus(this.obj.name);
      }
    },
  },
  style: {
    root: {
      _: [
        ".testFile;",
        "padding: 1px;",
        "cursor: pointer;",
      ],
      ":focused": "border: 2px solid blue; padding: 0px;",
      "[state=notloaded]": {header: "color: gray;"},
      "[state=running]": {header: "color: black;"},
      "[state=passed]": {header: "color: green;"},
      "[state=failed]": {header: "color: red;"},
      "[state=skipped]": {header: "color: gray;"},
    },
    header: [
      "padding: 2px;",
    ],
    toggleSolo: [
      "float: right;",
    ],
  },
});



}); // end define
