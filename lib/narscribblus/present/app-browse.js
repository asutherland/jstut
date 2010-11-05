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

require.def("narscribblus/present/app-browse",
  [
    "wmsy/wmsy",
    "narscribblus/present/type-basics",
    "exports",
  ],
  function(
    $wmsy,
    $ui_type_basics,
    exports
  ) {

var wy = new $wmsy.WmsyDomain({id: "app-browse",
                               domain: "jstut",
                               clickToFocus: true});

wy.defineWidget({
  name: "type-list",
  doc: "Expand all the provided types; nothing fancy.",
  constraint: {
    type: "type-list",
  },
  structure: {
    types: wy.vertList({type: "type", detail: "expanded"}),
  },
});


/**
 * Show the contents of a single document, processing the output stream for
 *  types and directly binding each
 */
exports.showDoc = function(parsed, doc) {
  var emitter = wy.wrapElement(document.getElementById("body"));

  var textStream = parsed.textStream, types = [];
  for (var i = 0; i < textStream.length; i++) {
    var node = textStream[i];
    // non-object nodes are not interesting
    if (!node || (typeof(node) !== "object"))
      continue;
    if (("isType" in node) && node.isType) {
      types.push(node);
    }
  }

  var rootObj = {
    types: types,
  };
  emitter.emit({type: "type-list", obj: rootObj});
};

});
