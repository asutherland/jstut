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
 * Functionality for dealing with text / doc streams.
 **/

define("jstut/mcstreamy",
  [
    "jstut/readers/scribble-syntax",
    "exports",
  ],
  function(
    $syn,
    exports
  ) {

/**
 * Consume the output of the text-stream at-breaker.  Its behaviour is to
 *  return a list whose items are one of:
 *
 * @return[@oneof[
 *   @case[String]{
 *     The text passed-in, verbatim-ish.
 *   }
 *   @case[AtCommand]{
 *     All s-expr values that are at-forms are first evaluated, then the
 *     function named by the AtCommand is invoked if it exists (otherwise a
 *     non-fatal error is reported).  It is up to the command to use the
 *     passed-in textStreamChewer to further process the text contents
 *   }
 *   @default{
 *     Something returned by a reader function.
 *   }
 * ]]
 */
function textStreamChewer(strOrNodes, ctx) {
  if (strOrNodes == null)
    return [];
  if (typeof(strOrNodes) === "string")
    return [strOrNodes];

  var onodes = [];
  for (var i = 0; i < strOrNodes.length; i++) {
    var node = strOrNodes[i];
    if ((typeof(node) !== "object") || (node == null)) {
      onodes.push(node);
    }
    else if (node instanceof $syn.AtCommand) {
      if (node.name in ctx.funcMap) {
        var preVal = undefined;
        if (node.name in ctx.funcPreMap) {
          preVal = ctx.funcPreMap[node.name](node.name, ctx);
        }

        // Push the node's name so its children can know their lineage.
        ctx.pushToken(node.name);

        // process all the svals and the textStream...
        var svals = node.svals === null ? []
                      : textStreamChewer(node.svals, ctx);
        var tvals = node.textStream === null ? null
                      : textStreamChewer(node.textStream, ctx);

        // Pop the node's name so it doesn't see itself as its own parent.
        ctx.popToken();

        var onode;
        try {
          onode = ctx.funcMap[node.name](node.name, svals, tvals, ctx,
                                         preVal);
        }
        catch (ex) {
          console.warn("explosion", ex, "processing node", node,
                       "svals", svals, "tvals", tvals, ex.stack);
        }
        if (onode)
          onodes.push(onode);
      }
      else {
        console.error("Unknown node command", node.name);
      }
    }
    // pass through anything we don't recognize
    else {
      onodes.push(node);
    }
  }
  return onodes;
}
exports.textStreamChewer = textStreamChewer;

/**
 * Filter a text stream for the types in args[1:] and returning the filtered
 *  list and the matches, if any.
 *
 * @args[
 *   @param["text stream" TextStream]
 *   @rest["type to filter on" Object]
 * ]
 * @return[@list[
 *   @param["filtered list" TextStream]{
 *     The stream with any matching types removed.
 *   }
 *   @rest["filter match" @oneof[null Object]]{
 *     null if there was no match, the matching object with the given type if
 *     it was found.
 *   }
 * ]]
 */
function snipeAndFilterTextStream(tvals) {
  var filterTypes = Array.prototype.slice.call(arguments, 1), iFilter;
  var filtered = [];
  var resultList = [filtered];
  for (iFilter = 0; iFilter < filterTypes.length; iFilter++)
    resultList.push(null);
  for (var i = 0; i < tvals.length; i++) {
    var o = tvals[i];
    for (iFilter = 0; iFilter < filterTypes.length; iFilter++) {
      if (o instanceof filterTypes[iFilter]) {
        resultList[1 + iFilter] = o;
        o = null;
        break;
      }
    }
    if (o)
      filtered.push(o);
  }
  return resultList;
}
exports.snipeAndFilterTextStream = snipeAndFilterTextStream;
// reuse the same logic for svals too...
var snipeAndFilterSVals = exports.snipeAndFilterSVals =
      snipeAndFilterTextStream;

/**
 * Filter a text stream for the types in args[1:] and returning the filtered
 *  list and the matches, if any.
 *
 * @args[
 *   @param["text stream" TextStream]
 *   @rest["type to filter on" Object]
 * ]
 * @return[@list[
 *   @param["filtered list" TextStream]{
 *     The stream with any matching types removed.
 *   }
 *   @rest["filter match" Array]{
 *     An Array containing the items of the given type.
 *   }
 * ]]
 */
function snipeAndFilterTextStreamToArrays(tvals) {
  var filterTypes = Array.prototype.slice.call(arguments, 1), iFilter;
  var filtered = [];
  var resultList = [filtered];
  for (iFilter = 0; iFilter < filterTypes.length; iFilter++)
    resultList.push([]);

  if (tvals == null)
    return resultList;

  for (var i = 0; i < tvals.length; i++) {
    var o = tvals[i];
    for (iFilter = 0; iFilter < filterTypes.length; iFilter++) {
      if (o instanceof filterTypes[iFilter]) {
        resultList[1 + iFilter].push(o);
        o = null;
        break;
      }
    }
    if (o)
      filtered.push(o);
  }
  return resultList;
}
exports.snipeAndFilterTextStreamToArrays = snipeAndFilterTextStreamToArrays;


}); // end define
