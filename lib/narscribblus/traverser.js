
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
      case "dict":
        inInterpSpace = true;
        curObj = arg;
        break;
      default:
        throw new Error("Illegal derefStack!");
    }
    for (i -= 2; (curObj !== null) && i >= 0; i -= 2) {
      cmd = derefStack[i], arg = derefStack[i + 1];
      switch (cmd) {
        case "attr":
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
            curObj = curObj.traverseChild(arg, childMode);
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

      switch (ipair[0]) {
        case "attr":
          derefStack.push("attr");
          derefStack.push(iobj.name);
          parseNode = iobj.owner;
          break;
        case "attrval":
          // nothing to dereference, semantically the same as the attr, hop
          //  over to the attr
          parseNode = iobj.attr;
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
          // if we made it up to the global scope, it's victory time
          if (("isGlobal" in iobj.container) && iobj.container.isGlobal) {
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
          parseNode = iobj.container;
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
    }

    if (parseNode.type !== "null")
      console.log("bottomed out on", {node: parseNode}, "from", synToken.value,
                  "current stack", derefStack);
    return null;
  },
};
exports.SynTraverser = SynTraverser;
