var syn = require("narscribblus/scribble-syntax");
var AtCommand = syn.AtCommand;

exports.parse = function parse(s, ctx) {
  return syn.textStreamAtBreaker(s, ctx);
};

/**
 * Consume the output of the text-stream at-breaker.  Its behaviour is to
 *  return either a single string or a list whose items are one of:
 * - A string.
 * - An AtCommand instance.
 * - Something returned by a reader function.
 */
function textStreamChewer(strOrNodes, ctx) {
  if (typeof(strOrNodes) == "string")
    return strOrNodes;

  var onodes = [];
  for (var i = 0; i < strOrNodes.length; i++) {
    var node = strOrNodes[i];
    if (typeof(node) !== "object") {
      onodes.push(node);
    }
    else if (node == null) {
      console.error("eating null node");
    }
    else if (node instanceof AtCommand) {
      if (node.name in ctx.funcMap) {
        var onode = ctx.funcMap[node.name](node.name, node.svals,
                                           node.textStream, ctx,
                                           textStreamChewer);
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

exports.expand = function expand(nodes, ctx) {
  return textStreamChewer(nodes, ctx);
};

function htmlStreamify(strOrNodes, options) {
  if (strOrNodes == null)
    return "";
  if (typeof(strOrNodes) == "string")
    return strOrNodes;

  var ostrs = [];
  for (var i = 0; i < strOrNodes.length; i++) {
    var node = strOrNodes[i];
    if (typeof(node) !== "object") {
      ostrs.push(node.toString());
    }
    else {
      if ("toHTMLString" in node)
        ostrs.push(node.toHTMLString(options));
      else
        ostrs.push(node.toString());
    }
  }
  return ostrs.join("");
}

exports.process = function process(nodes, ctx) {
  dump(htmlStreamify(nodes, {}));
};

function Fragment(aPieces) {
  this.pieces = aPieces;
}
exports.Fragment = Fragment;
Fragment.prototype = {
  toHTMLString: function(options) {
    return this.pieces.map(function (x) {return x.toHTMLString(options);}).join("");
  },
};

/**
 * Hierarchical section.
 */
function HierSection(aDepth, aTitle) {
  this.depth = aDepth;
  this.titleBits = aTitle;
  this.kids = null;
}
HierSection.prototype = {
  toHTMLString: function(options) {
    var hTag = "h" + (this.depth + 2);
    var s = "<" + hTag + ">";
    s += htmlStreamify(this.titleBits, options);
    s += "</" + hTag + ">";
    s += htmlStreamify(this.kids);
    return s;
  },
};

exports.narscribblusExecFuncs = {
  section: function(name, svals, tvals, ctx, tschewer) {
    return new HierSection(0, tschewer(tvals, ctx));
  },
  subsection: function(name, svals, tvals, ctx, chewer) {
    return new HierSection(1, tschewer(tvals, ctx));
  },
  subsubsection: function(name, svals, tvals, ctx, chewer) {
    return new HierSection(2, tschewer(tvals, ctx));
  },

  itemlist: function(name, svals, tvals, ctx, chewer) {
  },
  item: function(name, svals, tvals, ctx, chewer) {
  }
};
