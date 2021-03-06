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

define("jstut/esther/testresults-ui",
  [
    "wmsy/wmsy",
    "exports"
  ],
  function(
    $wmsy,
    exports
  ) {

var wy = exports.wy = new $wmsy.WmsyDomain({id: "testresults-ui",
                                            domain: "esther",
                                            clickToFocus: true});

wy.defineStyleBase("results", [
  "@good-fg-color: green;",
  "@good-bg-color: #ddffdd;",
  "@bad-fg-color: red;",
  "@bad-bg-color: #ffdddd;",
  "@neutral-fg-color: gray;",
]);

wy.defineWidget({
  name: "test-run-batch",
  doc: "Container for an entire test run.",
  constraint: {
    type: "test-run-batch",
  },
  structure: {
    runs: wy.vertList({type: "test-run-iteration"}, "testRuns"),
  }
});

wy.defineWidget({
  name: "test-run-iteration",
  doc: "It's a list inside a list because of the memory leak use-case...",
  constraint: {
    type: "test-run-iteration",
  },
  structure: {
    runs: wy.vertList({type: "test-run"}, wy.SELF),
  }
});

wy.defineWidget({
  name: "test-run",
  doc: "Run results for a single test function.",
  constraint: {
    type: "test-run",
  },
  structure: {
    pass: wy.bind("passed"),
    fail: wy.bind("failed", {count: "failed"}),
    duration: [wy.bind("duration_ms"), "ms"],
    name: wy.bind("name"),
    exceptions: wy.vertList({type: "exception"}, "exceptions"),
  },
  impl: {
    postInitUpdate: function postInitUpdate() {
      this.domNode.setAttribute("state",
                                this.obj.failed ? "failed" : "passed");
    },
  },
  style: {
    root: {
      _: [
        "font-size: 90%;",
      ],
      '[state="passed"]': [
        "background-color: @good-bg-color;",
      ],
      '[state="failed"]': [
        "background-color: @bad-bg-color;",
      ],
    },
    name: [
      "margin-after: 0.2em",
    ],
    pass: [
      "display: inline-block;",
      "text-align: right;",
      "width: 2em;",
      "color: @good-fg-color;",
      "margin-right: 0.2em",
    ],
    fail: {
      _: [
        "display: inline-block;",
        "text-align: right;",
        "width: 2em;",
        "color: @bad-fg-color;",
        "margin-right: 0.2em",
      ],
      "[count='0']": [
        "color: @neutral-fg-color;",
      ],
    },
    duration: [
      "display: inline-block;",
      "text-align: right;",
      "width: 3.5em;",
      "margin-right: 1em;",
      "color: #444;",
    ],
    exceptions: [
      "margin-left: 10em;",
    ],
  },
});

wy.defineWidget({
  name: "exception",
  doc: "A single exception, possibly including a backtrace.",
  constraint: {
    type: "exception",
  },
  structure: {
    message: wy.bind("message"),
    frames: wy.vertList({type: "stack-frame"}, "frames"),
  },
  style: {
    frames: [
      "margin-left: 1em;",
      "display: table;",
      "border-collapse: collapse;",
    ],
  }
});

wy.defineWidget({
  name: "stack-frame",
  doc: "A stack frame from an exception",
  constraint: {
    type: "stack-frame",
  },
  structure: {
    filename: wy.bind("filename"),
    lineNo: wy.bind("lineNo"),
    funcName: wy.bind("funcName"),
  },
  style: {
    root: [
      "display: table-row;",
    ],
    filename: "display: table-cell; padding: 0 4px;",
    funcName: "display: table-cell; padding: 0 4px;",
    lineNo: "display: table-cell; padding: 0 4px;",
  }
});

}); // end define
