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

var FAKE_RESULT =
  '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n' +
  '<html> \n' +
  ' <head> \n' +
  '  <title>Index of /cjs/narscribblus</title> \n' +
  ' </head> \n' +
  ' <body> \n' +
  '<h1>Index of /cjs/narscribblus</h1> \n' +
  '<pre><img src="/icons/blank.gif" alt="Icon "> <a href="?C=N;O=D;F=1">Name</a>                    <a href="?C=M;O=A;F=1">Last modified</a>      <a href="?C=S;O=A;F=1">Size</a>  <a href="?C=D;O=A;F=1">Description</a><hr><img src="/icons/back.gif" alt="[DIR]"> <a href="/cjs/">Parent Directory</a>                             -   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="data/">data/</a>                   04-Aug-2010 23:26    -   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="lib/">lib/</a>                    26-Jul-2010 07:19    -   \n' +
  '<img src="/icons/unknown.gif" alt="[   ]"> <a href="package.json">package.json</a>            03-Aug-2010 18:30  214   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="packages/">packages/</a>               03-Aug-2010 18:41    -   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="tests/">tests/</a>                  20-Aug-2010 23:45    -   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="web/">web/</a>                    11-Aug-2010 05:01    -   \n' +
  '<hr></pre> \n' +
  '<address>Apache/2.2.15 (Fedora) Server at depeche Port 80</address> \n' +
  '</body></html> \n';
var EXPECTED_RESULT = ["data/", "lib/", "package.json", "packages/", "tests/",
                       "web/"];

function mockXHR(result, statusCode) {
  var funk = function() {
    this.responseText = result;
    this.callback = null;
    this.status = (statusCode === undefined) ? 200 : statusCode;
  };
  funk.prototype = mockXHR_prototype;
  return funk;
}
var mockXHR_prototype = {
  open: function(method, url, async) {
    if (method !== "GET")
      throw new Error("I am a lazy fake; GET or death");
    if (!async)
      throw new Error("I am a lazy fake; async or death");
  },
  addEventListener: function(eventName, callback, ignoredCapture) {
    if (eventName !== "load")
      throw new Error(eventName + " is a stupid thing to listen for.");
    this.callback = callback;
  },
  // XXX we should really defer via the event loop or a timer...
  send: function(ignoredData) {
    this.callback();
  },
};

var pwomise = require("narscribblus/utils/pwomise");

/**
 * Test the list by making a fake xhr that just returns that thing up there.
 */
exports.testWebList = function(test) {
  var loader = test.makeSandboxedLoader({
    moduleOverrides: {
      xhr: {
        XMLHttpRequest: mockXHR(FAKE_RESULT),
      },
      // needs to use the same promise universe
      "narscribblus/utils/pwomise": pwomise,
    },
  });
  var listPromise = loader
    .require("narscribblus-plat/utils/unifile")
    .list("http://banana.banana/");
  pwomise.when(listPromise, function(items) {
    test.assertEqual(items.toString(), EXPECTED_RESULT.toString());
    test.done();
  });
  test.waitUntilDone(100);
};

