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
 * The manual language is for non-JS, non-source-code aware general
 *  documentation.  You would most likely only care about using this directly
 *  if you got it into your head that this was a reusable platform and love
 *  JavaScript as an implementation language.
 *
 * We define various things that are universally used.  I'm unclear if we should
 *  just refactor those out into langbits.
 **/

require.def("narscribblus/langs/manual",
  [
    "exports",
    "narscribblus/readers/scribble-syntax",
    "narscribblus/render/html",
    "narscribblus/mcstreamy",
  ],
  function (
    exports,
    syn,
    html,
    $docstreams
  ) {

var AtCommand = syn.AtCommand;
var htmlStreamify = html.htmlStreamify, htmlDocify = html.htmlDocify,
    stripHtml = html.stripHtml, htmlEscapeText = html.htmlEscapeText;

/**
 * Perform the parse phase for the manual language which entails parsing the
 *  entirety of the document as a text-stream with embedded at-forms.  This
 *  invokes macro-style readers but does not invoke functions referenced
 *  by at-forms; that happens during expansion.
 */
exports.parse = function parse(s, ctx) {
  return syn.textStreamAtBreaker(s, ctx);
};

var MULTIPLE_NEWLINES = /\n\s*\n/g;

/**
 * Process a list of nodes breaking it apart into paragraphs.  This does not
 *  recurse into nested logic.  At-forms and friends need to explicitly call
 *  this method if they want our breaking logic.
 *
 * This should probably not be directly accessed.  Instead, whatever is stashed
 *  on ParserContext's formatTextStream attribute should be used.
 */
function decodeFlow(strOrNodes) {
  if (strOrNodes == null)
    return null;
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
  return decodeFlow($docstreams.textStreamChewer(nodes, ctx));
};

/**
 * The process phase
 */
exports.process = function process(nodes, ctx) {
  return {
    body: htmlDocify(nodes, ctx),
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

function Title(tvals) {
  this.titleStream = tvals;
}
Title.prototype = {
  toHTMLString: function(options) {
    var htmlBits = htmlStreamify(this.titleStream, options);
    options.title = stripHtml(htmlBits);
    return "<h1>" + htmlBits + "</h1>";
  }
};

/**
 * Wrap the contents in a pre tag.
 */
function Preformatted(svals, tvals, ctx) {
  this.textStream = tvals;
}
Preformatted.prototype = {
  htmlDontWrapInPara: true,
  toHTMLString: function(options) {
    return "<pre>" + htmlStreamify(this.textStream, options) + "</pre>\n";
  },
};

/**
 * Immediate replacement!
 */
function Replacer(svals, tvals, ctx) {
  this.textContents = tvals.toString().replace(from, to, "g");
}
Replacer.prototype = {
  toHTMLString: function(options) {
    return htmlEscapeText(this.textContents);
  }
};

/**
 * Hierarchical section; creates h# tags.
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
  this.citingPackageName = ctx.packageName;
  this.docPath = svals[0];
  this.kids = tvals;
}
DocLink.prototype = {
  toHTMLString: function(options) {
    return '  <a' +
      options.makeDocLink(this.docPath, this.citingPackageName) +
      '>' +
      htmlStreamify(this.kids, options) +
      '</a>';
  }
};

function TermRef(svals, tvals, ctx) {
  this.term = tvals;
}
TermRef.prototype = {
  toHTMLString: function(options) {
    return htmlEscapeText(this.term);
  },
};

exports.narscribblusExecFuncs = {
  // --- general formatting
  title: function(name, svals, tvals, ctx) {
    return new Title(tvals);
  },

  pre: function(name, svals, tvals, ctx) {
    return new Preformatted(svals, tvals, ctx);
  },
  replace: function(name, svals, tvals, ctx) {
    return new Replacer(svals, tvals, ctx);
  },

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

  termref: function(name, svals, tvals, ctx) {
    return new TermRef(svals, tvals, ctx);
  },
};

}); // end require.def
