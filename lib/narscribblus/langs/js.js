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
 * Language file for processing JS source documents.
 *
 * - parse: Run the js file source through narcissus, retaining the tokens.
 * - expand: Run the js file through the abstract interpreter so we get the
 *    exports and an understanding of the general object hierarchy / namespace.
 *    Also, process comment blocks and associate them with specific namespace
 *    entries based on the results of abstract interpretation.
 * - process: Walk the list of tokens; when we find a comment block, parse it
 *    and associate it with the next node-linked token we see whose type is
 *    interesting.
 **/

define("narscribblus/langs/js",
  [
    "exports",
    "narscribblus/utils/pwomise",

    "narscribblus/narcissus/jsdefs",
    "narscribblus/narcissus/jsparse",
    "narscribblus/ctags/interp",

    "narscribblus/readers/js",
    "narscribblus/render/js",
    "narscribblus/render/html",

    "narscribblus/langs/manual",
    "narscribblus/mcstreamy",
    "narscribblus-plat/package-info",

    "narscribblus/docfusion",
    "narscribblus/interp-munge",

    "narscribblus/langbits/jsdoc",
    "narscribblus/typerep",
  ],
  function (
    exports,
    pwomise,

    jsdefs,
    jsparse,
    astinterp,

    reader_js,
    render_js,
    html,

    $man,
    $docstreams,
    pkginfo,

    docfusion,
    munge,

    jsdoc,
    typerep
  ) {

var when = pwomise.when;
var htmlEscapeText = html.htmlEscapeText;
var docFusion = docfusion.docFusion, ModuleInfo = docfusion.ModuleInfo;

var COMMENT_LINE = jsdefs.tokenIds["COMMENT_LINE"],
    COMMENT_BLOCK = jsdefs.tokenIds["COMMENT_BLOCK"],
    FUNCTION = jsdefs.tokenIds["FUNCTION"],
    IDENTIFIER = jsdefs.tokenIds["IDENTIFIER"],
    ASSIGN = jsdefs.tokenIds["ASSIGN"],
    OBJECT_INIT = jsdefs.tokenIds["OBJECT_INIT"],
    LEFT_CURLY = jsdefs.tokenIds["LEFT_CURLY"];

exports.parse = function parse(s, ctx) {
  // use the default decodeFlow implementation for doc blocks
  ctx.formatTextStream = $man.decodeFlow;

  if (!("mode" in ctx.options)) {
    ctx.options.mode = "source";
  }

  function parseItUp() {
    var parsed;
    try {
      parsed = jsparse.parseUntilRightCurly(s, ctx.filename, 1);
    }
    catch (ex) {
      dump("Syntax error around: " + s.substring(ex.cursor, ex.cursor+10) + "\n");
      console.error(ex);
      return null;
    }
    return parsed;
  }

  if (ctx.options.mode === "raw")
    return parseItUp();

  // If we don't already know the package for ourselves, get it and let it
  //  bootstrap.
  if (!("pkg" in ctx.options)) {
    return when(docFusion.getPackage(ctx.packageName),
                function(pkgInfo) {
                  ctx.options.pkg = pkgInfo;
                  return parseItUp();
                });
  }
  return parseItUp();
};
exports.expand = function expand(parsed, ctx) {
  var options = ctx.options, minfo;
  if (!("moduleInfo" in options))
    minfo = options.moduleInfo = new ModuleInfo(ctx.filename, ctx.options.pkg);
  else
    minfo = options.moduleInfo;

  minfo.formatTextStream = $man.decodeFlow;

  // XXX bail out if the parse failed.  we expect this to happen with fancy
  //  JS 1.8 stuff that our narcissus still has trouble with.
  if (!parsed) {
    minfo.exportNS = munge.mungeNamespace("exports", {}, minfo);
    minfo.globalNS = munge.mungeNamespace("global", {}, minfo);
    minfo.rawExportScope = {type: "object", data: {}};
    return minfo;
  }

  if (options.mode != "raw")
    jsCommentScannotate(parsed.tokenizer.tokenLog, ctx);

  var interpbox = new astinterp.InterpSandbox(docFusion);
  return when(interpbox.processModule(parsed.script,
                                      minfo.name), function(interp) {
    var scopes = interp.getScopes();
    //console.log("scopes", scopes);
    minfo.exportNS = munge.mungeNamespace("exports", scopes.exports, minfo);
    minfo.rawExportsScope = {
      type: "othermodule",
      data: scopes.exports,
      // create a link to the Namespace...
      node: {
        symbol: minfo.exportNS,
      },
    };
    minfo.globalNS = munge.mungeNamespace("global", scopes.global, minfo);

    return parsed;
  });
};

/**
 * Output the source as syntax-highlighted JS only, doing no special processing
 *  of comments or what not.
 */
function processRaw(parsed, ctx) {
  var block = new reader_js.JSBlock(null,
                                    parsed.tokenizer.tokenLog,
                                    parsed.script);
  return {
    app: "doc",
    textStream: [block],
  };
}

/**
 * A standalone comment block; looks like this:
 * @pre{@replace["!" "/"]{
 *   !**
 *    *
 *    **!
 * }}
 */
var CBLOCK_STANDALONE = 1;
/**
 * A comment block that describes the interesting thing that follows it; looks
 * like this:
 * @pre{@replace["!" "/"]{
 *   !**
 *    *
 *    *!
 * }}
 */
var CBLOCK_PRE = 2;
/**
 * A comment that groups/clusters the things that follow it.  Looks like:
 * @pre{
 *   ///////////////////////////////////////////////////////////////////////////
 *   // Group Name
 * }
 *
 * The distinguishing characteristic is that there is a line of slashes
 *  numbering 20 or more.  Maybe we should require crossing some column boundary
 *  instead.  I don't know.
 *
 * This grouping effect runs until we encounter another one of these or we
 *  encounter a line of slashes that is not immediately followed by another line
 *  comment on the next line (@xref{CBLOCK_GROUP_END}).
 *
 * The rationale behind supporting this style of grouping is that this is a
 *  nice way to visually delineate things in your code that does not require
 *  extra effort to use.  In contrast, doxygen uses a syntax for grouping that
 *  requires some maintenance burden, does not visually distinguish itself, and
 *  conflicts with the scribble syntax we have adopted.  So I hope you like this
 *  if you use this tool!
 *
 * XXX we can use the initial column number or number of slashes as a way to
 *  detect / handle nesting...
 */
var CBLOCK_GROUP_START = 3;
/**
 * A comment that terminates a group/cluster without starting a new one.  Looks
 *  like:
 * @pre{
 *   ///////////////////////////////////////////////////////////////////////////
 *   (anything but another line-comment here)
 * }
 */
var CBLOCK_GROUP_END = 4;

var FIRST_DONT_CARE_CBLOCK = 10;

/**
 * A license comment block that should generally be ignored.  If the first line
 * of the license includes "BEGIN LICENSE BLOCK" then we categorize the comment
 * thusly.
 */
var CBLOCK_LICENSE = 10;
/**
 * A comment that holds an emacs/vim/whatever is popular enough for us to know
 * about it.  This generally gets ignored.
 */
var CBLOCK_MODELINE = 11;
/**
 * A comment that we do not believe is intended for us.  This means all line
 *  comments that do not form part of a grouping construct
 */
var CBLOCK_NOTFORUS = 20;

var RE_DOCBLOCK_TRIMMER = /^ *\*/gm;
var RE_LINECOMMENT_TRIMMER = /^\/+/;
var RE_DOCBLOCK_LICENSE = /^[ *]*BEGIN LICENSE BLOCK/;
var RE_MODELINE = /^ *(?:-\*- mode:)|vim: /;

/**
 * Categorize a block comment into one of the CBLOCK_* values.
 */
function categorizeBlockComment(blockStr) {
  if (RE_DOCBLOCK_LICENSE.test(blockStr))
    return CBLOCK_LICENSE;
  if (RE_MODELINE.test(blockStr))
    return CBLOCK_MODELINE;

  if (blockStr[0] === "*"){
    if (blockStr[blockStr.length - 1] === "*")
      return CBLOCK_STANDALONE;
    return CBLOCK_PRE;
  }

  return CBLOCK_NOTFORUS;
}

/**
 * Wraps an @xref{HtmlNode} text stream in an object that can be linked to a
 *  @xref{Symish} node and also be associated with a @xref{Grouping}.
 */
function DocNode(rawTextStream, formattedStream) {
  // keep the raw stream for fetchin' semantic objects
  this.rawStream = rawTextStream;
  this.formattedStream = formattedStream;
  this.sym = null;
  this.group = null;
}
DocNode.prototype = {
  kind: "docnode",
  /**
   * Check the rawStream for an instance of the given taggy thing..
   */
  hasTag: function(taggyThing) {
    if (!this.rawStream)
      return false;
    for (var i = 0; i < this.rawStream.length; i++) {
      if (this.rawStream[i] instanceof taggyThing)
        return true;
    }
    return false;
  },
  toHTMLString: function(options) {
    return html.htmlStreamify(this.textStream, options);
  }
};

/**
 * A grouping entity; DocNodes are assigned to groups.  When group-aware
 *  @xref{Symish} mungers see a group-associated @xref{Symish} child, they
 *  create an @xref{InstantiatedGrouping} to actually hold the named children.
 *  They do not use us directly because we are not clever enough, given our
 *  syntax for grouping blocks, to make sure Grouping objects are constrained to
 *  a single parent container.
 */
function Grouping(name, docNode) {
  this.name = name;
  this.docNode = docNode;
}
Grouping.prototype = {
};

/**
 * Parse a documentation block as scribble syntax and expand it into
 *  text-streams wrapped in DocNode objects.  The DocNode objects then provide
 *  convenience methods to get at top-level semantic objects in the text stream.
 */
function parseDocBlockAsScribble(s, ctx) {
  try {
    var parsed = $man.parse(s, ctx);
    var rawStream = $docstreams.textStreamChewer(parsed, ctx);
    var formattedStream = ctx.formatTextStream(rawStream);
    return new DocNode(rawStream, formattedStream);
  }
  catch (ex) {
    console.warn("Problem parsing comment block. ex:", ex, "comment:", s);
  }
  return null;
}

/**
 * Process the comment block as a narscribblus scribble language bit.
 */
function chewCommentBlock(blockStr, ctx) {
  blockStr = blockStr.replace(RE_DOCBLOCK_TRIMMER, "");
  return parseDocBlockAsScribble(blockStr, ctx);
}

/**
 * Process the first line as the name of the group and all subsequently lines
 *  as part of a scribble syntaxed block.
 */
function chewGroupLines(contentTokens, ctx) {
  // Lose any extra leading front slashes and then any whitespace.
  // (We're only losing the front slashes for the non-body case just because
  //  I stole the idea for this from mozStorage but it turns out we use/sdwilsh
  //  uses 4 of them in there.)
  var name = contentTokens[0].value.replace(RE_LINECOMMENT_TRIMMER, "").trim();
  var blockStr = contentTokens.slice(1)
                   .map(function (t) { return t.value; }).join("\n");
  var docNode = parseDocBlockAsScribble(blockStr, ctx);
  return new Grouping(name, docNode);
}

var RE_GROUP_LINE = /^\/{18,}$/;
var RE_WHITESPACE = /^ +$/;

/**
 * Scan through the JS source tokens, detecting comment blocks, processing them,
 *  and associating them with the correct namespace / tokeny entry.  We also
 *  detect the @xref{CBLOCK_GROUP_START}/@xref{CBLOCK_GROUP_END} grouping syntax
 *  and use that to associate documentation with groups.
 *
 * Group association is a potentially tricky thing given that the language does
 *  not require or strongly encourage organization like Java or Python do.  To
 *  avoid having to deal with groups becoming a cross-cutting construct (I
 *  figure we'll use tags for that) whenever we see
 *
 *
 * All scanned comment tokens are annotated with an "inlineComment" attribute
 *  that expresses whether it should be treated as part of the source code
 *  (true) or whether we observed it to be part of a block comment or other
 *  documentation-related magic (false).
 */
function jsCommentScannotate(tokens, ctx) {
  var options = ctx.options;
  var modInfo = options.moduleInfo;

  // The active group object; set/cleared when we hit all-slashes lines.
  var activeGroup = null;
  // If we are in a run of group line comments, the list of the content bearing
  //  nodes.  We set this to a new list when we see the all-slashes line and
  //  detect an end if the list is empty when we hit a non line comment line.
  var inGroupRun = null;
  // A documentation node in search of an interesting/namespace object to latch
  //   onto
  var pendingDocNode = null, i;

  /**
   * Peek for tokens, pretending whitespace literals don't exist.
   */
  function peekTokenIsType(fwd, type) {
    var reli = i;
    // ugly hack to give us an extra iteration to make sure we don't end up on
    //  a whitespace node.
    var donecheck = true;
    while (fwd || donecheck) {
      // bail if we're trying to exist past the end
      if (reli >= tokens.length)
        return false;
      // skip string tokens...
      if (typeof(tokens[reli]) === "string") {
        reli++;
        continue;
      }
      // if we're still traversing, traverse...
      if (fwd) {
        fwd--;
        reli++;
      }
      // or if we're in the done check, then we passed the done check and can
      //  terminate...
      else {
        donecheck = false;
      }
    }
    return (tokens[reli].type === type);
  }

  for (i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    if (token.type === COMMENT_LINE) {
      if (inGroupRun) {
        inGroupRun.push(token);
        token.inlineComment = false;
      }
      else if (RE_GROUP_LINE.test(token.value)) {
        inGroupRun = [];
        token.inlineComment = false;
      }
      else {
        token.inlineComment = true;
      }
    }
    else if (inGroupRun) {
      // if this is whitespace and we can peek and see another comment line,
      //  then just skip this token.
      if (typeof(token) === "string" && RE_WHITESPACE.test(token) &&
          (i + 1 < tokens.length) && (tokens[i + 1].type === COMMENT_LINE))
        continue;

      if (inGroupRun.length)
        activeGroup = chewGroupLines(inGroupRun, ctx);
      else
        activeGroup = null;

      inGroupRun = null;
    }

    if (token.type === COMMENT_BLOCK) {
      var blockType = categorizeBlockComment(token.value);
      if (blockType < FIRST_DONT_CARE_CBLOCK) {
        var docNode = token.rawDocNode = chewCommentBlock(token.value, ctx);
        if (activeGroup)
          docNode.group = activeGroup;
        if (blockType === CBLOCK_PRE) {
          pendingDocNode = docNode;
        }
        else if (blockType === CBLOCK_STANDALONE) {
          if (!modInfo.fileDocNode)
            modInfo.fileDocNode = docNode;
          else
            modInfo.standaloneDocNodes.push(docNode);
        }
      }
      else if (blockType === CBLOCK_NOTFORUS) {
        // keep comments that aren't for us
        token.inlineComment = true;
      }
      else {
        // but gobble comments that are boring
        token.inlineComment = false;
      }
    }

    // Attempt to attach the doc node to the parse node by following the
    //  nodeLink up from the lexer token stream to the parser nodes.
    if (pendingDocNode) {
      switch (token.type) {
        case IDENTIFIER:
          // if an object is being assigned to us, let the docnode latch to
          //  the object init instead (so bail)
          if (peekTokenIsType(1, ASSIGN) && peekTokenIsType(2, LEFT_CURLY))
            break;
          // (fall-through)
        case FUNCTION:
        case LEFT_CURLY: // OBJECT_INIT equiv
          // make sure the left curly is for an OBJECT_INIT...
          if ((token.type === LEFT_CURLY) &&
              (!token.nodeLink || token.nodeLink.type !== OBJECT_INIT))
            break;

          token.nodeLink.docNode = pendingDocNode;
          pendingDocNode = null;
          break;
      }
    }
  }
}

/**
 * Traverse the token stream looking for comment blocks and invoking the
 *  @lxref{commentChewer} on them.
 */
function jsCommentSlicer(tokens, ctx) {
  var options = ctx.options;
  var nodes = [];
  var renderFromToken = 0;

  function flushJSTokens(throughToken) {
    if (throughToken === renderFromToken)
      return;
    var block = new reader_js.JSBlock(null,
                                      tokens.slice(renderFromToken,
                                                   throughToken + 1),
                                      null);
    nodes.push(block);
  }

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token.type === COMMENT_BLOCK ||
        token.type === COMMENT_LINE) {
      // suppress this comment token since it's not inline
      if (!token.inlineComment) {
        flushJSTokens(i - 1);
        renderFromToken = i + 1;

        // and if there's a raw doc node, emit that.
        if ("rawDocNode" in token) {
          nodes.push(token.rawDocNode);
        }

        continue;
      }
    }
  }
  flushJSTokens(tokens.length - 1);

  return nodes;
}

/**
 * Parse the comment blocks and replace them with their narscribblus scribble
 *  parsed HTML output.  We use @xref{jsCommentSlicer} to drive this.
 */
function processInlineDocs(parsed, ctx) {
  return {
    app: "doc",
    textStream: jsCommentSlicer(parsed.tokenizer.tokenLog, ctx),
  };
}

/**
 * For use by @xref{processIlluminated} to wrap DocNodes and runs of code
 */
function IllWrapper(styleClass, nodes) {
  this.styleClass = styleClass;
  this.nodes = nodes;
}
IllWrapper.prototype = {
  toHTMLString: function(options) {
    return "<div class='" + this.styleClass + "'>" +
      html.htmlStreamify(this.nodes, options) +
      "</div>\n";
  }
};

/**
 * Same deal as @xref{processInlineDocs} but styled after Atul's code
 *  illuminated documentation tool.
 *
 * This specifically entails generating 3 divs for every pairing of
 *  documentation and code:
 * @itemize[
 *   @item{The HTML documentation block.}
 *   @item{The code block.}
 *   @item{A divider that resets stuff.}
 * ]
 */
function processIlluminated(parsed, ctx) {
  ctx.options.hierMode = "flat";

  // This ends up as a bunch of nodes that are either JSBlock instances or
  //  DocNode instances.  Group runs so that anytime we see a documentation node
  //  we flush the current set of JS blocks, follow it with a divider, emit the
  //  doc node, then start accumulating JS blocks again.
  var nodes = jsCommentSlicer(parsed.tokenizer.tokenLog, ctx);
  var illnodes = [];

  var jsBlocks = [];
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node instanceof DocNode) {
      if (jsBlocks.length) {
        illnodes.push(new IllWrapper("code", jsBlocks));
        illnodes.push(new IllWrapper("divider", []));
        jsBlocks = [];
      }
      illnodes.push(new IllWrapper("documentation", [node]));
    }
    else if (node instanceof reader_js.JSBlock) {
      jsBlocks.push(node);
    }
    else {
      console.error("I do not expect this:", node);
      throw new Error("I got something I really just did not expect.");
    }
  }
  if (jsBlocks.length) {
    illnodes.push(new IllWrapper("code", jsBlocks));
    illnodes.push(new IllWrapper("divider", []));
  }

  return {
    body: html.htmlDocify(
      [new IllWrapper("content", illnodes)],
      ctx,
      [pkginfo.dataDirUrl("narscribblus/css/illuminated.css")]),
    liveject: null,
  };
}

/**
 * Output the ModuleInfo for this file in a sort of debuggy world view.  This
 *  is not currently intended to be an output form for regular human
 *  consumption.
 */
function processShowModuleInfo(parsed, ctx) {
  var options = ctx.options;
  var minfo = options.moduleInfo;

  console.log("modinfo", minfo);

  return {
    app: "browse",
    textStream: [minfo.exportNS, minfo.globalNS],
  };
}

/**
 * Used by @xref{PackageFusion} to process a source file just for its nougaty
 *  @xref{ModuleInfo} goodness.
 */
function processMeta(parsed, ctx) {
  // there is nothing to actually do; expand has all the side-effects we
  //  wanted and the ModuleInfo instance is on ctx.options.
  return {};
}

exports.process = function process(parsed, ctx) {
  switch (ctx.options.mode) {
    case "raw":
      return processRaw(parsed, ctx);
    case "source":
      return processInlineDocs(parsed, ctx);
    case "atul": // (non-canonical)
    case "illuminated": // (canonical)
      return processIlluminated(parsed, ctx);
    case "modinfo":
      return processShowModuleInfo(parsed, ctx);
    case "meta":
      return processMeta(parsed, ctx);
    default:
      throw new Error("mode '" + ctx.options.mode + "' is not a real mode");
  }
};

exports.narscribblusReaderFuncs = {
  js: reader_js.reader_js,
  jselided: reader_js.reader_elided_js,
};

// These are parsing the scribble-syntax doc blocks, of course, not the
//  javascript code.
exports.narscribblusParserDepResolve = function(ctx) {
  ctx.slurpModuleContributions($man);
  ctx.slurpModuleContributions(jsdoc);
};

}); // end define
