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
 * Mechanisms for declaring that various types define or conform to/obey
 *  specific protocols.
 **/

define("jstut/protocols",
  [
    "exports",
  ],
  function(
    exports
  ) {

/**
 * Associates a specific protocol name with whatever object's documentation
 *  block it is declared in the context of.  We might also consider allowing
 *  this to be used in a standalone block with a specifically named type as
 *  the second argument.
 *
 * XXX not fully implemented!
 */
function Protocol(name, type, docStream) {
  this.name = name;
  this.type = type;
  this.docStream = null;
}
Protocol.prototype = {
  kind: "object",
  isType: true,
  isAnonymous: false,
};
exports.Protocol = Protocol;

/**
 * Declares that an object obeys the explicitly named protocols.  Goes on the
 *  doc block of the type in question.
 *
 * XXX not actually implemented!
 */
function Obeys(svals, tvals, ctx) {

}
Obeys.prototype = {
};
exports.Obeys = Obeys;

}); // end define
