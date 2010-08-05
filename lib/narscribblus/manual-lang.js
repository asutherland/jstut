var syn = require("narscribblus/scribble-syntax");
var AtCommand = syn.AtCommand;

/**
 * Perform the parse phase for the manual language which entails parsing the
 *  entirety of the document as a text-stream with embedded at-forms.  This
 *  invokes macro-style readers but does not invoke functions referenced
 *  by at-forms; that happens during expansion.
 */
exports.parse = function parse(s, ctx) {
  return syn.textStreamAtBreaker(s, ctx);
};

/**
 * Consume the output of the text-stream at-breaker.  Its behaviour is to
 *  return either a single string or a list whose items are one of:
 * - A string.
 * - An AtCommand instance.  All s-expr values that are at-forms are first
 *    evaluated, then the function named by the AtCommand is invoked if it
 *    exists (otherwise a non-fatal error is reported).  It is up to the command
 *    to use the passed-in textStreamChewer to further process the text contents
 * - Something returned by a reader function.
 */
function textStreamChewer(strOrNodes, ctx) {
  if (typeof(strOrNodes) == "string")
    return strOrNodes;

  var onodes = [];
  for (var i = 0; i < strOrNodes.length; i++) {
    var node = strOrNodes[i];
    if ((typeof(node) !== "object") || (node == null)) {
      onodes.push(node);
    }
    else if (node instanceof AtCommand) {
      if (node.name in ctx.funcMap) {
        // process all the svals and the textStream...
        var svals = textStreamChewer(node.svals, ctx);
        var tvals = textStreamChewer(node.textStream);

        var onode = ctx.funcMap[node.name](node.name, svals, tvals, ctx);
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
 * Uses @xref{textStreamChewer} to execute at-forms.
 */
exports.expand = function expand(nodes, ctx) {
  return textStreamChewer(nodes, ctx);
};

/**
 * Helper function to stringify a list of objects, preferring use of a
 *  toHTMLString method when available over toString.  When primitives are
 *  encountered they are stringified sanely.
 */
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
exports.htmlStreamify = htmlStreamify;

/**
 * Convert an expanded list of objects into an HTML document.  This is a 2-pass
 *  operation.  We streamify the objects and then use the contents of options
 *  to help build the rest of the document.
 *
 * The ad hoc collaboration through options, especially having it named options,
 *  is not sitting well with me right now, but we can refactor it if this
 *  project has legs once things are usably worky.
 *
 * Currently the fields are:
 * - cssBlocks: A list of strings that are joined with newlines and crammed into
 *    a style block.
 */
function htmlDocify(strOrNodes, options) {
  options.cssBlocks = [];
  options.namedCssBlocks = {};
  var bodyString = htmlStreamify(strOrNodes, options);
  var s = "<!DOCTYPE html>\n<html><head><title>Narscribblus</title>";
  s += '<style type="text/css">' + options.cssBlocks.join('\n') + '</style>';
  s += "</head><body>";
  s += bodyString;
  s += "</body></html>";
  return s;
}
exports.htmlDocify = htmlDocify;


/**
 * The process phase
 */
exports.process = function process(nodes, ctx) {
  return {
    body: htmlStreamify(nodes, {}),
    liveject: null,
  };
};

/**
 * Tagged class that exists to let a single return value contain multiple
 *  objects without having to prematurely toHTMLString flatten them.  Only
 *  proxies/handles toHTMLString right now.
 */
function Fragment(aPieces) {
  this.pieces = aPieces;
}
exports.Fragment = Fragment;
Fragment.prototype = {
  toHTMLString: function(options) {
    return this.pieces.map(function (x) {
      return x.toHTMLString(options);
    }).join("");
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
    s += htmlStreamify(this.kids, options);
    return s;
  },
};

function ItemizedList(kids) {
  this.kids = kids;
}
ItemizedList.prototype = {
  toHTMLString: function(options) {
    return "<ul>\n" + htmlStreamify(this.kids, options) + "</ul>\n";
  },
};

function Item(kids) {
  this.kids = kids;
}
Item.prototype = {
  toHTMLString: function(options) {
    return "  <li>" + htmlStreamify(this.kids, options) + "</li>\n";
  },
};

exports.narscribblusExecFuncs = {
  section: function(name, svals, tvals, ctx) {
    return new HierSection(0, tvals);
  },
  subsection: function(name, svals, tvals, ctx) {
    return new HierSection(1, tvals);
  },
  subsubsection: function(name, svals, tvals, ctx) {
    return new HierSection(2, tvals);
  },

  itemize: function(name, svals, tvals, ctx) {
    return new ItemizedList(svals);
  },
  item: function(name, svals, tvals, ctx) {
    return new Item(tvals);
  }
};
