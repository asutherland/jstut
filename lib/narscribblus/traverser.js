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

define("narscribblus/traverser",
  [
    "exports",
  ],
  function(
    exports
  ) {

/**
 * Give it a syntax token and have it return to you the documented type
 *  information, if any, available on the token.  The goals are:
 * @itemize[
 *   @item{Provide information about API calls used.}
 *   @item{Provide information about the role being played by user code by
 *         figuring out the types/sub-type role of the specific bits of code.}
 * ]
 */
function SynTraverser() {

}
SynTraverser.prototype = {
  /**
   * Given a syntax token return the type information/documentation node that
   *  best describes the thing.  Or null if it's a mystery to us.
   */
  traverse: function(synToken) {
    var derefStack = this.refstackForToken(synToken);
    if (!derefStack)
      return null;

    var i = derefStack.length - 2;
    var cmd = derefStack[i], arg = derefStack[i + 1];
    var childMode = undefined, curObj, inInterpSpace;
    switch(cmd) {
      case "instanceof":
        inInterpSpace = false;
        childMode = "instance";
        curObj = arg;
        break;
      case "sym":
        inInterpSpace = false;
        curObj = arg;
        break;
      case "dict":
        inInterpSpace = true;
        curObj = arg;
        break;
      default:
        throw new Error("Illegal derefStack!");
    }
    for (i -= 2; (curObj !== null) && i >= 0; i -= 2) {
      // Pierce descriptors on the way in (rather than the way out, because
      //  we want our return values to remain un-piereced.)
      if (curObj.kind === "descriptor")
        curObj = curObj.resolvedType;

      cmd = derefStack[i], arg = derefStack[i + 1];
      switch (cmd) {
        case "attr":
        case "attrval":
          if (inInterpSpace) {
            if (!(arg in curObj.data))
              return null;
            curObj = curObj.data[arg];
            // If the interpreter object has a node with a symbol, then we
            //  can cross over into symbol/type info space.
            if (("node" in curObj) && ("symbol" in curObj.node)) {
              curObj = curObj.node.symbol;
              inInterpSpace = false;
            }
          }
          else {
            var nextObj = curObj.traverseChild(
                            arg,
                            cmd === "attrval" ? "value" : childMode);
            if (nextObj == null) {
              console.log("traversal", cmd, "arg", arg, "failed on", curObj);
            }
            curObj = nextObj;
            childMode = undefined;
          }
          break;
        case "arg":
          if (inInterpSpace) {
            // interpreter space has no concept of what arguments mean.
            return null;
          }
          curObj = curObj.traverseArg(arg);
          break;
        default:
          throw new Error("Illegal derefstack command: " + cmd);
      }
    }

    if (inInterpSpace) {
      console.log("traverser hit the end of the road without crossing out of " +
                  "interpreter space:", curObj);
      return null;
    }

    return curObj;
  },

  /**
   * Given a syntax token, produce a series of dereference operations that
   *  describe the traversal operations required to get to the documentation
   *  that best describes the syntax token.
   *
   * We do this by hopping from the syntax token to the parse `Node` best
   *  associated with the syntax token.  Then we follow the chain of
   *  `InterpObj` instances that we annotate onto parse nodes.  For example,
   *  an attribute value in an object dictionary definition will link to
   *  the attribute name thing which will link to the object, which then
   *  might know that it is argument 1 in a function call on a certain object
   *  found on a certain object with a known type.
   *
   * For each chain link we process we push two objects; the type of traversal
   *  and the argument to that traversal.  Because we don't reverse the list
   *  ourselves, callers will want to traverse it from the end in a pairwise
   *  fashion.  See `traverse`.
   */
  refstackForToken: function(synToken) {
    var derefStack = [];

    // walk up from the syntax token to the parse tree node, if possible.
    var parseNode;
    // (funcLinks are established on the identifiers of named functions and
    //  link back to the function parse node, follow it because the function
    //  is where the more useful annotations will be.)
    if ("funcLink" in synToken) {
      parseNode = synToken.funcLink;
    }
    else if ("argLink" in synToken) {
      // hop over to the owning function
      parseNode = synToken.argLink[0];
      // keeping track of the argument that we are...
      derefStack.push("arg");
      derefStack.push(synToken.argLink[1]); // (number)
    }
    // (nodeLinks are established when a Node is created)
    else if ("nodeLink" in synToken) {
      parseNode = synToken.nodeLink;
    }

    if (!parseNode)
      return null;

    // get the interpObj left behind by the abstract interpreter
    if (!("interpObj" in parseNode))
      return null;

    while ("interpObj" in parseNode) {
      var ipair = parseNode.interpObj;
      var iobj = ipair[1];
//console.log("traverse", ipair[0], iobj);
      switch (ipair[0]) {
        case "attr":
          derefStack.push("attr");
          derefStack.push(iobj.name);
          parseNode = iobj.owner;
          break;
        case "attrval":
          derefStack.push("attrval");
          // jump through to the attr
          iobj = iobj.attr.interpObj[1];
          derefStack.push(iobj.name);
          parseNode = iobj.owner;
          break;
        case "arg":
          derefStack.push("arg");
          derefStack.push(iobj.index);
          parseNode = iobj.owner;
          break;
        case "arglist":
          // just pierce the arglist... jump to the owning func
          parseNode = iobj.func;
          break;
        case "ref":
          derefStack.push("attr");
          derefStack.push(iobj.name);
          // if we made it up to the global or exports scope, it's victory time
          if ((("isGlobal" in iobj.container) && iobj.container.isGlobal) ||
              (("isExports" in iobj.container) && iobj.container.isExports)) {
            derefStack.push("dict");
            derefStack.push(iobj.container);
            return derefStack;
          }
          // if we made it to a commonJS namespace, it's also victory time.
          if (iobj.container.type == "othermodule") {
            derefStack.push("dict");
            derefStack.push(iobj.container);
            return derefStack;
          }
          // otherwise, walk up the scope...
          parseNode = iobj.container.node;
          break;
        case "new":
          // abstract interpretation hits a wall with newed types, which means
          //  we're either good if the node we ended up on has type information,
          //  or sad if it does not.
          if ("symbol" in iobj) {
            derefStack.push("instanceof");
            derefStack.push(iobj.symbol);
            return derefStack;
          }
          console.log("hit a new but don't know what to do", iobj);
          return null;
        default:
          throw new Error("unknown interp link kind" + ipair[0]);
      }

      if (!parseNode)
        break;

      // If we transitioned to a node that has a symbol, just use that direct.
      // (Differs from the "new" interpObj case because that implies a
      //  childMode.)
      if ("symbol" in parseNode) {
        derefStack.push("sym");
        derefStack.push(parseNode.symbol);
        return derefStack;
      }
    }
/*
    if ((parseNode == null) || (parseNode.type !== "null"))
      console.log("bottomed out on", {node: parseNode}, "from", synToken.value,
                  "current stack", derefStack);
*/
    return null;
  },
};
exports.SynTraverser = SynTraverser;

}); // end define
