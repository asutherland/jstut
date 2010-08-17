
/**
 * Language file for processing JS source documents.
 *
 * - parse: Run the js file source through narcissus, retaining the tokens.
 * - expand: Run the js file through the abstract interpreter so we get the
 *    exports and an understanding of the general object hierarchy / namespace.
 * - process: Walk the list of tokens; when we find a comment block, parse it
 *    and associate it with the next node-linked token we see whose type is
 *    interesting.
 **/

var jsdefs = require("narscribblus/narcissus/jsdefs");
var jsparse = require("narscribblus/narcissus/jsparse");
var astinterp = require("narscribblus/ctags/interp");

var COMMENT_LINE = jsdefs.tokenIds["COMMENT_LINE"],
    COMMENT_BLOCK = jsdefs.tokenIds["COMMENT_BLOCK"];

exports.parse = function parse(s, ctx) {
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
  var interp = new astinterp.Interpreter(parsed.script, ctx.filename, [],
                                         {commonJS: true});
  interp.interpret();
  return parsed;
};
exports.process = function process(parsed, ctx) {
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

/**
 * Get the source for a module using require's semantics and search path.
 */
function requireSource(moduleName) {
  var loader = packaging.harnessService.loader;
  var path = loader.fs.resolveModule(null, moduleName);
  var o = loader.fs.getFile(path);
  return o.contents;
}
exports.requireSource = requireSource;
