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

define("narscribblus/typeref",
  [
    "exports",
  ],
  function(
    exports
  ) {

/**
 * Maintains an indirect type reference; we can't resolve types at expansion
 *  time so we need some form of promise like this.
 *
 * @obeys[HtmlNode]
 *
 * @args[
 *   @param[s String]{
 *     The type name.
 *   }
 *   @param[pkg PackageFusion]{
 *     The package the reference is being made in the context of.  This should
 *     perhaps support a module level of granularity instead...
 *   }
 * ]
 */
function TypeRef(s, pkg) {
  if (!pkg)
    throw new Error("I need a package!");
  this.name = s;
  this.pkg = pkg;
  this.resolved = null;
}
TypeRef.prototype = {
  // fake!
  genus: "typeref",
  isAnonymous: false,

  _resolve: function() {
    if (this.resolved)
      return true;

    this.resolved = this.pkg.resolveInternal(this.name);
    if (this.resolved) {
      console.log("resolved", this.s, "to", this.resolved);
      return true;
    }

    return false;
  },

  traverseChild: function(name, childMode) {
    if (!this._resolve())
      return null;
    return this.resolved.traverseChild(name, childMode);
  },
  traverseArg: function(index) {
    if (!this._resolve())
      return null;
    return this.resolved.traverseArg(index);
  },

  get kind() {
    if (!this._resolve())
      return "unresolved";
    return this.resolved.kind;
  },

  /**
   * Unresolvable types are boring.
   */
  get isBoring() {
    if (!this._resolve())
      return true;
    return this.resolved.isBoring;
  },
};
exports.TypeRef = TypeRef;

}); // end define
