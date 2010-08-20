
/**
 * The manual language is for non-JS, non-source-code aware general
 *  documentation.  You would most likely only care about using this directly
 *  if you got it into your head that this was a reusable platform and love
 *  JavaScript as an implementation language.
 *
 * We define various things that are universally used.  I'm unclear if we should
 *  just refactor those out into langbits.
 **/

var syn = require("narscribblus/readers/scribble-syntax");
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
        if (node.name in ctx.funcPreMap) {
          ctx.funcPreMap[node.name](node.name, ctx);
        }

        // process all the svals and the textStream...
        var svals = node.svals === null ? null
                      : textStreamChewer(node.svals, ctx);
        var tvals = node.textStream === null ? null
                      : textStreamChewer(node.textStream, ctx);

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

var MULTIPLE_NEWLINES = /\n\s*\n/g;

/**
 * Process a list of nodes breaking it apart into paragraphs.  This does not
 *  recurse into nested logic.  At-forms and friends need to explicitly call
 *  this method if they want our breaking logic.
 */
function decodeFlow(strOrNodes) {
  if (typeof(strOrNodes) == "string")
    strOrNodes = [strOrNodes];

  var accum = [], para;
  var onodes = [];

  function flushAccum() {
    if (accum.length) {
      onodes.push(new Para(accum));
      accum = [];
    }
  }

  for (var i = 0; i < strOrNodes.length; i++) {
    var node = strOrNodes[i];
    if (typeof(node) === "string") {
      if (MULTIPLE_NEWLINES.test(node)) {
        // fuse what we've acculumated with the first bit
        var paraBits = node.split(MULTIPLE_NEWLINES);
        accum.push(paraBits[0]);
        flushAccum();

        // eat any complete paragraphs
        for (var iBit = 1; iBit < paraBits.length - 1; iBit++) {
          onodes.push(new Para([paraBits[iBit]]));
        }

        // put the remainder on the accumulator
        accum = paraBits.slice(-1);
        // (if the last thing was empty, just clobber it.)
        if (!accum[0].length)
          accum = [];
      }
      else {
        accum.push(node);
      }
    }
    // if we encounter a node that can't be wrapped in a paragraph, then
    //  it serves as a de-facto paragraph break.
    else if ("htmlDontWrapInPara" in node) {
      flushAccum();
      onodes.push(node);
    }
    // things that aren't strings and don't explicitly demand to be kept out
    //  of paragraphs get accumulated for inclusion in a paragraph.
    else {
      accum.push(node);
    }
  }
  flushAccum();
  return onodes;
}
exports.decodeFlow = decodeFlow;

/**
 * Uses @xref{textStreamChewer} to execute at-forms.
 */
exports.expand = function expand(nodes, ctx) {
  return decodeFlow(textStreamChewer(nodes, ctx));
};

var RE_AMPER = /&/g;
var RE_LESSTHAN = /</g;
var RE_GREATERTHAN = />/g;
function htmlEscapeText(str, options) {
  return str.replace(RE_AMPER, "&amp;")
            .replace(RE_LESSTHAN, "&lt;")
            .replace(RE_GREATERTHAN, "&gt;");
}
exports.htmlEscapeText = htmlEscapeText;

/**
 * Helper function to stringify a list of objects, preferring use of a
 *  toHTMLString method when available over toString.  When primitives are
 *  encountered they are stringified sanely.
 */
function htmlStreamify(strOrNodes, options) {
  if (strOrNodes == null)
    return "";
  if (typeof(strOrNodes) == "string")
    return htmlEscapeText(strOrNodes, options);

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
        ostrs.push(htmlEscapeText(node.toString(), options));
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
  var s = "<!DOCTYPE html>\n<html>\n<head><title>Narscribblus</title>\n";
  s += '<style type="text/css">' + options.cssBlocks.join('\n') + '</style>\n';
  s += "</head>\n<body>\n";
  s += bodyString;
  s += "</body>\n</html>";
  return s;
}
exports.htmlDocify = htmlDocify;


/**
 * The process phase
 */
exports.process = function process(nodes, ctx) {
  return {
    body: htmlStreamify(nodes, ctx.options),
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
}
HierSection.prototype = {
  htmlDontWrapInPara: true,
  toHTMLString: function(options) {
    var hTag = "h" + (this.depth + 2);
    var s = "<" + hTag + ">";
    s += htmlStreamify(this.titleBits, options);
    s += "</" + hTag + ">\n";
    return s;
  },
};

function Para(kids) {
  this.kids = kids;
}
Para.prototype = {
  htmlDontWrapInPara: true,
  toHTMLString: function(options) {
    var s = htmlStreamify(this.kids, options).trim();
    // just gobble empty payloads
    if (s.length)
      return "<p>" + s + "</p>\n\n";
    else
      return "";
  }
};

function ItemizedList(kids) {
  this.kids = kids;
}
ItemizedList.prototype = {
  htmlDontWrapInPara: true,
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

function Example(svals, tvals) {
  this.name = svals[0];
  this.kids = decodeFlow(tvals);
}
Example.prototype = {
  toHTMLString: function(options) {
    return "<b>Example: " + this.name + "</b>\n" +
      htmlStreamify(this.kids, options) + "\n";
  },
};

function DocLink(svals, tvals, ctx) {
  this.docPath = svals[0];
  this.kids = tvals;
}
DocLink.prototype = {
  toHTMLString: function(options) {
    return '  <a' + options.makeDocLink(this.docPath) + '>' +
           htmlStreamify(this.kids, options) +
           '</a>';
  }
};

exports.narscribblusExecFuncs = {
  // --- general formatting
  // -- sections / headers
  section: function(name, svals, tvals, ctx) {
    return new HierSection(0, tvals);
  },
  subsection: function(name, svals, tvals, ctx) {
    return new HierSection(1, tvals);
  },
  subsubsection: function(name, svals, tvals, ctx) {
    return new HierSection(2, tvals);
  },

  // -- lists
  itemize: function(name, svals, tvals, ctx) {
    return new ItemizedList(svals);
  },
  item: function(name, svals, tvals, ctx) {
    return new Item(tvals);
  },

  // -- example demarcation
  example: function(name, svals, tvals, ctx) {
    return new Example(svals, tvals);
  },

  // -- linking
  doclink: function(name, svals, tvals, ctx) {
    return new DocLink(svals, tvals, ctx);
  },
};
