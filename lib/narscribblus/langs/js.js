
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

var COMMENT_LINE = jsdefs.tokenIds["COMMENT_LINE"],
    COMMENT_BLOCK = jsdefs.tokenIds["COMMENT_BLOCK"];

exports.parse = function parse(s, ctx) {
  if (!("mode" in ctx.options)) {
    ctx.options.mode = "raw";
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
  var interp = new astinterp.Interpreter({commonJS: true});
  interp.interpretAst(parsed.script, true);
  interp.allDoneDoStuff();
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

var RE_DOCBLOCK_TRIMMER = /^ +\*/g;

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

exports.process = function process(parsed, ctx) {
  switch (ctx.options.mode) {
    case "raw":
      return processRaw(parsed, ctx);
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
