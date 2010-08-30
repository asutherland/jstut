
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
      parseNode = argLink.synToken[0];
      // keeping track of the argument that we are...
      derefStack.push("arg");
      derefStack.push(argLink.synToken[1]);
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
    var ipair = token.interpObj;

    while (ipair)
    switch (ipair[0]) {
      case "attr":
        break;
      case "attrval":
        break;
      case "arg":
        break;
      case "arglist":
        break;
      case "ref":
        break;
    }

  },
};
