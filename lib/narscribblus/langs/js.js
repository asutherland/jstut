
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

var ModuleInfo = require("narscribblus/docfusion").ModuleInfo;

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

  var interp = new astinterp.Interpreter({commonJS: true});
  interp.interpretAst(parsed.script, true);

  var scopes = interp.getScopes();
  console.log("scopes", scopes);
  minfo.exportNS = scopes.exports;
  minfo.globalNS = scopes.global;

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

var RE_DOCBLOCK_TRIMMER = /^ +\*/g;
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
 * Process the comment block as a narscribblus scribble language bit.
 */
function chewCommentBlock() {

}

function chewGroupLines(contentTokens) {

}

var RE_GROUP_LINE = /^\/{18,}$/;

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
function jsCommentScannotate(tokens) {
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
      if (inGroupRun.length)
        activeGroup = chewGroupLines(inGroupRun);
      else
        activeGroup = null;

      inGroupRun = null;
    }

    if (token.type === COMMENT_BLOCK) {
      var blockType = categorizeBlockComment(token.value);
      if (blockType < FIRST_DONT_CARE_CBLOCK) {
        var docNode;
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

    // attempt to attach the doc node...
    if (pendingDocNode) {
      switch (token.type) {
        case
      }
    }

  }
}

/**
 * Traverse the token stream looking for comment blocks and invoking the
 *  @lxref{commentChewer} on them.
 */
function jsCommentSlicer(tokens, commentChewer) {
  var bits = [];
  var renderFromToken = 0;

  function flushJSTokens(throughToken) {
    if (throughToken === renderFromToken)
      return;
    var block = new reader_js.JSBlock(null,
                                      tokens.slice(renderFromToken,
                                                   throughToken + 1),
                                      null);
    bits.push(render_js.htmlifyJSBlock(block));
  }

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    // if it's a multi-line comment block, we're interested.
    if (token.type === COMMENT_BLOCK &&
        token.value.indexOf("\n") != -1) {
      flushJSTokens(i - 1);

      var sansAsterisks = token.value.replace(RE_DOCBLOCK_TRIMMER, "");
      console.log("comment block", sansAsterisks);

      renderFromToken = i + 1;
    }
  }
  flushJSTokens(tokens.length - 1);

  return bits.join("");
}

/**
 * Parse the comment blocks and replace them with their narscribblus scribble
 *  parsed HTML output.  We use @xref{jsCommentSlicer} to drive this.
 */
function processInlineDocs(parsed, ctx) {

}

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

}

/**
 * Render a namespace
 */
function htmlifyNamespace(nsName, ns) {
  var bits = [];
  bits.push("<h2>" + htmlEscapeText(nsName) + "</h2>\n");
  bits.push("<dl>\n");
  for (var key in ns) {
    bits.push("  <dt>" + htmlEscapeText(key) + "</dt>\n");
  }
  bits.push("</dl>\n");
  return bits.join("");
}

/**
 * Output the ModuleInfo for this file in a sort of debuggy world view.  This
 *  is not currently intended to be an output form for regular human
 *  consumption.
 */
function processShowModuleInfo(parsed, ctx) {
  var minfo = ctx.options.moduleInfo;

  var bits = [];
  bits.push(htmlifyNamespace("exports", minfo.exportNS));
  bits.push(htmlifyNamespace("module global scope", minfo.globalNS));

  console.log("modinfo", minfo);

  return {
    body: html.simpleDoc(ctx.filename, bits.join("")),
    liveject: null,
  };
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
    default:
      throw new Error("mode '" + ctx.options.mode + "' is not a real mode");
  }

  var tokens = parsed.tokenizer.tokenLog;
  var pendingComment = null;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    if (token.type == COMMENT_BLOCK) {
      pendingComment = token;
    }

    if ("nodeLink" in token) {
      console.log("nodelinked", JSON.stringify(token.nodeLink));
    }
  }
};
