
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
            return derefStack;
          }
          // otherwise, walk up the scope...
          parseNode = iobj.container;
          break;
        default:
          throw new Error("unknown interp link kind" + ipair[0]);
      }
    }

    if (parseNode.type !== "null")
      console.log("bottomed out on", parseNode, "from", synToken.value);
    return null;
  },
};
exports.SynTraverser = SynTraverser;
