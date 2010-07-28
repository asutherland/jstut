var reg = require("narscribblus/reader-reg");

var jsparse = require("narscribblus/narcissus/jsparse");

/**
 * Represents a block of JS code as:
 * - The actual text
 *
 * Could represent it as but we throw it away:
 * - The narcissus parsed result.
 */
function JSBlock(text) {
  this.text = text;
}
exports.JSBlock = JSBlock;
JSBlock.prototype = {
};


/**
 * Parses a block of JS code (up until a closing '}') using the narcissus
 *  parser.
 */
function reader_js(s, ctx, svals) {
  var pr = jsparse.parseUntilRightCurly(s, ctx.filename, ctx.line);

  // find the offset of the } that killed the parsing to find the range to
  //  eat.  It should be the only character in lookahead so the cursor should
  //  point one beyond it.
  var endex = pr.tokenizer.cursor - 1;
  var block = new JSBlock(s.substring(0, endex));
  return [block, endex + 1];
}
exports.reader_js = reader_js;
