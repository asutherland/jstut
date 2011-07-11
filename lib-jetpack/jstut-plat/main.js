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

define("jstut-plat/main",
  [
    "exports",
    "narscribblus/doc-loader",
    "jstut-plat/skwbl-protocol",
    "xul-app",
    "self",
  ],
  function(
    exports,
    loader,
    uglyproto,
    xulapp,
    self
  ) {

/**
 * Open a tab or a window to show our bootstrap chrome loader, providing it with
 *  a URI that can tell it how to get back to us.
 */
function showWhereYouCan(aFilename) {
  var url = "about:narscribblus?doc=" + encodeURIComponent(aFilename);
  if (xulapp.is("Firefox")) {
    var tabs = require("tabs");
    tabs.open({ url: url });
  }
  else {
    var contentWindow = require("jstut-plat/opc/content-window");
    var window = new contentWindow.Window({
      url: url,
      width: 1100, height: 1000,
    });
  }
}
exports.showWhereYouCan = showWhereYouCan;

exports.main = function geckgrok_main(options, callbacks) {
  var args = options.cmdline;
  // so, let's not rewrite getopt.  I'm sure one exists, but let's just be
  //  very very very ugly for now.
  if (args === undefined) {
    console.error("You need to use the hacked up harness driver!");
    return callbacks.quit("FAIL");
  }

  if (args.length == 0) {
    console.error("Specify a command.");
    return callbacks.quit("FAIL");
  }

  // parse a skwbl file and dump its processed result to stdout
  if (args[0] == "parse") {
    var s = self.data.load(args[1]);
    loader.parseDocument(s, args[1], {}, function(results) {
      dump(results.body);
      callbacks.quit("OK");
    });
    return undefined;
  }

  if (args[0] == "nullparse") {
    var s = self.data.load(args[1]);
    loader.parseDocument(s, args[1], {}, function(results) {
      callbacks.quit("OK");
    });
    return undefined;
  }

  // show a skwbl file in a chrome tab
  if (args[0] == "show") {
    showWhereYouCan(args[1]);
    return undefined;
  }

  return callbacks.quit("FAIL");
};

}); // end define
