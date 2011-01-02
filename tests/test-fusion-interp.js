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
 * Test that the abstract interpretation works, assigning doc blocks
 *  appropriately and propagating things across module boundaries correctly.
 *  We check each thing once for the synchronous case and once for the async
 *  (define) case.
 **/

define("narscribblus-tests/test-fusion-interp",
  [
    "narscribblus/docfusion",
    "narscribblus/utils/pwomise",
    "exports"
  ],
  function(
    $docfusion,
    $pwomise,
    exports
  ) {

var docFusion = $docfusion.docFusion;
var when = $pwomise.when;

var TEST_PACKAGE = "narscribblus/testfodder";

var SYNC_ONE = TEST_PACKAGE + "/sync_one";
var SYNC_TWO = TEST_PACKAGE + "/sync_two";

var ASYNC_ONE = TEST_PACKAGE + "/async_one";
var ASYNC_TWO = TEST_PACKAGE + "/async_two";


function docStreamContains(thing, s) {
  function traverseStream(arr) {
    for (var i = 0; i < arr.length; i++) {
      if (typeof(arr[i]) === "string") {
        if (arr[i].indexOf(s) >= 0)
          return true;
      }
      else if ((typeof(arr[i]) === "object") &&
               ("kids" in arr[i])) {
        if (traverseStream(arr[i].kids))
          return true;
      }
    }
    return false;
  }
  if (!thing.docStream)
    return false;
  return traverseStream(thing.docStream);
}

function checkOne(test, minfo) {
  var exportNS = minfo.exportNS;

  // should contain tlObjAsSingleton
  test.assert("tlObjAsSingleton" in exportNS.childrenByName,
              "tlObjAsSingleton in export namespace");
  var singly = exportNS.childrenByName.tlObjAsSingleton;
  // should have proper doc node with the right contents
  test.assert(singly.docStream != null, "non-null docStream");
  test.assert(docStreamContains(singly, "AAAA"), "docStream contents");
  // sanity check docStreamContains with a known false case
  test.assert(!docStreamContains(singly, "ZZZZ"), "should fail to find");

  test.assert("methVoidVoid" in singly.childrenByName);
  test.assert(docStreamContains(singly.childrenByName.methVoidVoid,
                                "AAAB"));

  test.assert("methIntInt" in singly.childrenByName);
  test.assert(docStreamContains(singly.childrenByName.methIntInt,
                                "AAAC"));

  test.done();
}

exports.testInterpSyncStandalone = function(test) {
  test.waitUntilDone();
  when(docFusion.requireModule(SYNC_ONE), checkOne.bind({}, test));
};

function checkTwo(test, minfo) {
  var globalNS = minfo.globalNS;

  test.assert("one" in globalNS.childrenByName, "one in global namespace");
  var one = globalNS.childrenByName.one;
  test.assertEqual(one.name, "exports");

  test.done();
}

exports.testInterpSyncRequiresOther = function(test) {
  test.waitUntilDone();
  when(docFusion.requireModule(SYNC_TWO), checkTwo.bind({}, test));
};

exports.testInterpAsyncStandalone = function(test) {
  test.waitUntilDone();
  when(docFusion.requireModule(ASYNC_ONE), checkOne.bind({}, test));
};

exports.testInterpAsyncRequiresOther = function(test) {
  test.waitUntilDone();
  when(docFusion.requireModule(ASYNC_TWO), checkTwo.bind({}, test));
};

}); // end define
