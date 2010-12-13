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
 * Defines various types of cross-references.
 **/

require.def("narscribblus/xref",
  [
    "narscribblus/readers/scribble-syntax",
    "narscribblus/typeref",
    "exports",
  ],
  function(
    $syn,
    $typeref,
    exports
  ) {

var coerceString = $typeref.coerceString;

/**
 * Local cross-reference.  We walk up the 'type' hierarchy looking for a place
 *  where the given term has meaning.
 *
 * @itemize[
 *   @item{Dictionary key names.}
 *   @item{Function arguments.}
 *   @item{Class methods / fields.}
 *   @item{Global type names.}
 * ]
 */
function LocalXRef(svals, tvals, ctx) {
  this.name = tvals.toString();
  this.scopeStack = ctx.snapshotNamedContextStack("lexicalTypeScope");
}
LocalXRef.prototype = {
  /**
   * Resolve the cross-reference.  You ideally want to call this as late as
   *  possible to ensure that all types have been fully loaded.
   */
  resolve: function() {
    var scopeStack = this.scopeStack;
    // - check the explicit lexical stack (tops out at the module scope)...
    for (var i = scopeStack.length - 1; i >= 0; i--) {
      var scope = scopeStack[i];
      var thing;
      if ("traverseChild" in scope)
        thing = scope.traverseChild(this.name);
      if (!thing && ("traverseArg" in scope))
        thing = scope.traverseArg(this.name);
      if (thing)
        return thing;
    }
    // - fail over to the package doc namespace

  },
  toHTMLString: function(options) {

  },
};
exports.LocalXRef = LocalXRef;

/**
 * Package global cross-reference; the term is assumed to start from the
 *  package's documentation global namespace.
 */
function PackageXRef() {

}
PackageXRef.prototype = {

};
exports.PackageXRef = PackageXRef;

/**
 * Cross-reference an argument of a constructor/function for type referencing
 *  purposes.  The general idea is that if you are just passing an argument
 *  through to some function/constructor that uses a one-off anonymous type,
 *  there is no real need for you to go through the effort of making it an
 *  explicitly named type and the extra confusion that might entail.
 *
 * And before you ask, yes, in theory we could magically determine such things,
 *  but this is one of those "not bloody likely in practice" theories.
 */
function ArgRef(svals, tvals, ctx) {
  this.resolved = null;
  this.s = coerceString(svals[0]);
  this.pkg = ctx.options.pkg;
  if (!this.pkg)
    throw new Error("I need a package!");
  this.docStream = tvals;
}
ArgRef.prototype = {
  __proto__: $typeref.TypeRef.prototype,

  isType: true,
  _resolve: function() {
    if (this.resolved)
      return true;

    // pierce the type; we don't want to discuss the name of the other argument!
    this.resolved = this.pkg.traverse(this.s).type;
    if (this.resolved)
      return true;
    return false;
  },
  descriptionHTML: function(options) {
    return html.htmlStreamify(this.docStream, options);
  },
};
exports.ArgRef = ArgRef;


}); // end require.def
