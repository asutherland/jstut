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
 * Combination of a custom protocol to make sure we can load bespin in with the
 *  chrome privileges the rest of the document has and the legwork to splice
 *  the 'script' tag and what not into a document to use that protocol.
 **/

var PROTO_NAME = "narbespin";
var protocol = require("narscribblus-plat/opc/custom-protocol")
                 .register(PROTO_NAME);
var self = require("self");

protocol.setHost("files", self.data.url("bespin/"), "system");

exports.loadBespin = function loadBespin(doc, callback) {
  var rawWin = doc.defaultView.wrappedJSObject;
  rawWin.onBespinLoad = callback;
  rawWin.console = console;

  var head = doc.getElementsByTagName('head')[0];
  var link = doc.createElement('link');
  link.setAttribute("id", "bespin_base", "system");
  link.setAttribute("href", PROTO_NAME + "://files/");
  head.appendChild(link);

  var script = doc.createElement("script");
  script.src = PROTO_NAME + "://files/BespinEmbedded.js";
  head.appendChild(script);
};

exports.useBespin = function useBespin(doc, name, opts) {
  doc.defaultView.wrappedJSObject.bespin.useBespin(name, opts);
};
