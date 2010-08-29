
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

var jsdefs = require("narscribblus/narcissus/jsdefs");
var jsparse = require("narscribblus/narcissus/jsparse");
var astinterp = require("narscribblus/ctags/interp");

var reader_js = require("narscribblus/readers/js");
var render_js = require("narscribblus/render/js");
var html = require("narscribblus/render/html");
var htmlEscapeText = html.htmlEscapeText;

var man = require("narscribblus/langs/manual");
var self = require("self");

var ModuleInfo = require("narscribblus/docfusion").ModuleInfo;
var munge = require("narscribblus/interp-munge");

var COMMENT_LINE = jsdefs.tokenIds["COMMENT_LINE"],
    COMMENT_BLOCK = jsdefs.tokenIds["COMMENT_BLOCK"],
    FUNCTION = jsdefs.tokenIds["FUNCTION"],
    IDENTIFIER = jsdefs.tokenIds["IDENTIFIER"];

exports.parse = function parse(s, ctx) {
  if (!("mode" in ctx.options)) {
    ctx.options.mode = "modinfo";
  }

  var parsed;
  try {
    parsed = jsparse.parseUntilRightCurly(s, ctx.filename, 1);
  }
  catch (ex) {
    dump("Syntax error around: " + s.substring(ex.cursor, ex.cursor+10) + "\n");
    throw ex;
  }

  return parsed;
};
exports.expand = function expand(parsed, ctx) {
  var options = ctx.options, minfo;
  if (!("moduleInfo" in options))
    minfo = options.moduleInfo = new ModuleInfo(ctx.filename, null);
  else
    minfo = options.moduleInfo;

  if (options.mode != "raw")
    jsCommentScannotate(parsed.tokenizer.tokenLog, ctx);

  var interp = new astinterp.Interpreter({commonJS: true});
  interp.interpretAst(parsed.script, true);

  var scopes = interp.getScopes();
  console.log("scopes", scopes);
  minfo.exportNS = munge.mungeNamespace("exports", scopes.exports, minfo);
  minfo.globalNS = munge.mungeNamespace("global", scopes.global, minfo);

  return parsed;
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
    body: html.htmlDocify([block], ctx),
    liveject: null,
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

function DocNode(rawTextStream) {
  // keep the raw stream for fetchin semantic objects
  this.rawStream = rawTextStream;
  this.sym = null;
  this.group = null;
}
DocNode.prototype = {
  linkToSym: function(aSym) {
    this.sym = aSym;
    aSym.docNode = this;
  },
  get textStream() {
    return man.decodeFlow(this.rawStream);
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
  var parsed = man.parse(s, ctx);
  return new DocNode(man.textStreamChewer(parsed, ctx));
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
  var name = contentTokens.value.strip();
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
  var pendingDocNode = null;
  for (var i = 0; i < tokens.length; i++) {
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
        case FUNCTION:
        case IDENTIFIER:
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
  ctx.options.hierMode = "flat";
  return {
    body: html.htmlDocify(
            jsCommentSlicer(parsed.tokenizer.tokenLog, ctx), ctx),
    liveject: null,
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
    body: html.htmlDocify([new IllWrapper("content", illnodes)], ctx,
                          [self.data.load("css/illuminated.css")]),
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
    body: html.htmlDocify([minfo.exportNS, minfo.globalNS],
                          options,
                          [self.data.load("css/js-doc-bits.css")]),
    liveject: null,
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
  ctx.slurpModuleContributions(require("narscribblus/langs/manual"));
  ctx.slurpModuleContributions(require("narscribblus/langbits/jsdoc"));
};
