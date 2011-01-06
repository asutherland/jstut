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

define("narscribblus/langs/manual",
  [
    "narscribblus-plat/package-info",
    "narscribblus/readers/scribble-syntax",
    "narscribblus/render/html",
    "narscribblus/mcstreamy",
    "narscribblus/utils/pwomise",
    "exports"
  ],
  function (
    $pkginfo,
    syn,
    html,
    $docstreams,
    $pwomise,
    exports
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
  if (ctx.options.mode == "raw")
    ctx.tokenRuns = [];
  try {
    // normally we can just do this synchronously, but...
    return syn.textStreamAtBreaker(s, ctx);
  }
  catch(ex) {
    // this constructs a rejection promise
    return ctx.logParseFailure(ex);
  }
};

// for test() we don't want "g" because that gives the regexp memory
var MULTIPLE_NEWLINES_TEST = /\n\s*\n/;
// but for splitting we do want "g" so it splits more than once!
var MULTIPLE_NEWLINES_SPLIT = /\n\s*\n/g;

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
    return [];
  if (typeof(strOrNodes) == "string")
    strOrNodes = [strOrNodes];

  // The general strategy is to walk the list of nodes, building things up
  //  into paragraphs based on whitespace hinting in the form of at least one
  //  blank line.  We use the MULTIPLE_NEWLINES regex which looks for a newline
  //  followed by a line that contains only whitespace on it followed by a
  //  newline.
  //
  // At-command by-products get wrapped into those paragraphs based on the
  //  same whitespace heuristics unless the objects are marked with a
  //  "htmlDontWrapInPara" attribute.  In that case, we close out any active
  //  paragraph so that the thing does not get wrapped in the paragraph.
  var accum = [], para;
  var onodes = [];

  function flushAccum() {
    if (accum.length) {
      onodes.push(new Para(accum));
      accum = [];
    }
  }

  // only push things that are non-just-whitespace strings
  function maybePush(s) {
    if (typeof(s) === "string") {
      s = s.trim();
      if (s.length === 0)
        return;
    }
    accum.push(s);
  }

  for (var i = 0; i < strOrNodes.length; i++) {
    var node = strOrNodes[i];
    // It's a string which may or may not include paragraph-break whitespace.
    //  If it doesn't, just throw it on the accumulator.  If it does, throw
    //  whatever comes before the paragraph break on the accumulator and flush
    //  the accumulator.  Then process the whole paragraphs and leave any
    //  leftovers on the accumulator.
    if (typeof(node) === "string") {
      // -- paragraphs!
      if (MULTIPLE_NEWLINES_TEST.test(node)) {
        // - partial
        var paraBits = node.split(MULTIPLE_NEWLINES_SPLIT);
        maybePush(paraBits[0]);
        flushAccum();

        // - complete paragraphs
        // (there could be zero of these)
        for (var iBit = 1; iBit < paraBits.length - 1; iBit++) {
          var bit = paraBits[iBit].trim();
          if (bit.length)
            onodes.push(new Para([bit]));
        }

        // - leftovers
        accum = [];
        maybePush(paraBits[paraBits.length - 1]);
      }
      else {
        maybePush(node);
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
  // er, we really want people to be using forcelang=narscribblus/raw?
  /*
  if (ctx.options.mode == "raw") {
    return {
      body: html.htmlDocify(
        ctx.tokenRuns,
        ctx,
        [$pkginfo.dataDirUrl("narscribblus/css/syntax-scribble-proton.css")]),
      liveject: null,
    };
  }
  */
  return {
    app: "doc",
    textStream: nodes,
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
  toDOMNode: function(doc, recursiveFab) {
    return [doc.createDocumentFragment(), this.pieces];
  },
};

function Title(tvals) {
  this.titleStream = tvals;
}
Title.prototype = {
  // XXX this used to set the title as a side-effect, which is no longer
  //  a reasonable way to do things.
  toDOMNode: function(doc, recursiveFab) {
    return [doc.createElement("h1"), this.titleStream];
  },
};

/**
 * Wrap the contents in a pre tag.
 */
function Preformatted(svals, tvals, ctx) {
  this.textStream = tvals;
}
Preformatted.prototype = {
  htmlDontWrapInPara: true,
  toDOMNode: function(doc, recursiveFab) {
    return [doc.createElement("pre"), this.textStream];
  },
};

/**
 * Immediate replacement!
 */
function Replacer(svals, tvals, ctx) {
  this.textContents = tvals.toString().replace(from, to, "g");
}
Replacer.prototype = {
  toDOMNode: function(doc, recursiveFab) {
    return doc.createTextNode(this.textContents);
  },
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
  toDOMNode: function(doc, recursiveFab) {
    return [doc.createElement("h" + (this.depth + 2)), this.titleBits];
  },
};

function Para(kids) {
  this.kids = kids;
}
Para.prototype = {
  htmlDontWrapInPara: true,
  toDOMNode: function(doc, recursiveFab) {
    if (!this.kids.length)
      return doc.createTextNode("");

    return [doc.createElement("p"), this.kids];
  },
};
exports.Para = Para;

function ItemizedList(kids) {
  this.kids = kids;
}
ItemizedList.prototype = {
  htmlDontWrapInPara: true,
  toDOMNode: function(doc, recursiveFab) {
    return [doc.createElement("ul"), this.kids];
  },
};

function Item(kids) {
  this.kids = kids;
}
Item.prototype = {
  toDOMNode: function(doc, recursiveFab) {
    return [doc.createElement("li"), this.kids];
  },
};

function Example(svals, tvals) {
  this.name = svals[0];
  this.kids = decodeFlow(tvals);
}
Example.prototype = {
  toDOMNode: function(doc, recursiveFab) {
    var node = doc.createDocumentFragment();
    var heading = doc.createElement("b");
    heading.textContent = this.name;
    node.appendChild(heading);
    return [node, this.kids];
  },
};

/**
 * An inline link to a document that should be treated as part of a text run
 *  like a normal hyperlink.  Compare with a `TopicLink` which is intended to be
 *  extracted/elided from the document stream or otherwise set apart.
 */
function DocLink(svals, tvals, ctx) {
  this.citingPackageName = ctx.packageName;
  this.docPath = svals[0];
  this.kids = tvals;
}
DocLink.prototype = {
  kind: "doclink",
};
exports.DocLink = DocLink;

/**
 * An extractable link to a document; this may be sucked out of a doc stream
 *  in order to be displayed in a privileged UI location.  If left in-stream,
 *  the link will be given special styling which distinguishes it from
 *  hyperlinks such as `DocLink`s.
 */
function TopicLink(svals, tvals, ctx) {
  this.citingPackageName = ctx.packageName;
  this.docPath = svals[0];
  this.kids = tvals;
}
TopicLink.prototype = {
  kind: "topiclink",
};
exports.TopicLink = TopicLink;


function TermRef(svals, tvals, ctx) {
  this.term = tvals;
}
TermRef.prototype = {
  // XXX this too needs to be surfaced as a wmsy widget
  toDOMNode: function(doc, recursiveFab) {
    return [doc.createElement("a"), this.term];
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

  topiclink: function(name, svals, tvals, ctx) {
    return new TopicLink(svals, tvals, ctx);
  },

  termref: function(name, svals, tvals, ctx) {
    return new TermRef(svals, tvals, ctx);
  },
};

}); // end define
