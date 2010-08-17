var render_js = require("narscribblus/render/js");
var jsparse = require("narscribblus/narcissus/jsparse");

/**
 * Represents a block of JS code as:
 * - The actual text
 *
 * Could represent it as but we throw it away:
 * - The narcissus parsed result.
 */
function JSBlock(text, tokens, script) {
  this.text = text;
  this.tokens = tokens;
  this.script = script;
}
exports.JSBlock = JSBlock;
JSBlock.prototype = {
  // by default, if our holder does not have anything better to do with us,
  //  render static-like
  htmlDontWrapInPara: true,
  toHTMLString: function(options) {
    return render_js.htmlifyJSBlock(this, options);
  }
};


/**
 * Parses a block of JS code (up until a closing '}') using the narcissus
 *  parser.
 */
function reader_js(s, ctx, svals, elideList) {
  var pr;
  try {
    pr = jsparse.parseUntilRightCurly(s, ctx.filename, ctx.line, elideList);
  }
  catch (ex) {
    dump("Syntax error around: " + s.substring(ex.cursor, ex.cursor+10) + "\n");
    throw ex;
  }

  // find the offset of the } that killed the parsing to find the range to
  //  eat.  It should be the only character in lookahead so the cursor should
  //  point one beyond it.
  var endex = pr.tokenizer.cursor - 1;
  var block = new JSBlock(s.substring(0, endex),
                          pr.tokenizer.tokenLog.slice(0, -1),
                          pr.script);
  return [block, endex + 1];
}
exports.reader_js = reader_js;

var DEFAULT_ELIDED_WATCH_LIST = [
  [".", "...", 0],
];

/**
 * Parses a block of JS code (up until a closing '}') using the narcissus
 *  parser but skipping certain exactly quoted patterns provided as svals
 *  or just "..." if no svals are provided.
 */
function reader_elided_js(s, ctx, svals) {
  // XXX handle other elide list...
  return reader_js(s, ctx, svals, DEFAULT_ELIDED_WATCH_LIST);
}
exports.reader_elided_js = reader_elided_js;
