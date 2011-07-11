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

define("jstut/readers/js",
  [
    "exports",
    "jstut/render/js",
    "jstut/narcissus/jsparse",
    "jstut/narcissus/jsdefs",
  ],
  function (
    exports,
    render_js,
    jsparse,
    jsdefs
  ) {

var tokenIds = jsdefs.tokenIds;

const STRING = tokenIds["STRING"],
      COMMENT_LINE = tokenIds["COMMENT_LINE"],
      COMMENT_BLOCK = tokenIds["COMMENT_BLOCK"];

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
  kind: "jsblock",

  // by default, if our holder does not have anything better to do with us,
  //  render static-like
  htmlDontWrapInPara: true,

  /**
   * Create a string from our token stream.  You would want to favor this over
   *  the raw text since we do clever things with whitespace.
   */
  flattenTokenStream: function() {
    var s = "", tokens = this.tokens;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (typeof(token) === "string") {
        s += token;
      }
      else {
        if ("str" in token)
          s += token.str;
        else if (token.type === STRING)
          s += token.quoteChar + token.value + token.quoteChar;
        else if (token.type === COMMENT_LINE)
          s += "//" + token.value + "\n";
        else if (token.type === COMMENT_BLOCK)
          s += "/*" + token.value + "*/";
        else
          s += token.value;
      }
    }
    return s;
  },
};

function JSTokenRun(tokens) {
  this.tokens = tokens;
}
JSTokenRun.prototype = {
  kind: "jsblock",
};

/**
 * Parses a block of JS code (up until a closing '}') using the narcissus
 *  parser.
 */
function reader_js(s, ctx, svals, elideList) {
  var pr;
  // For now, we always pass 1 as the initial line with the expectation that
  //  our exception will be relativized on the way up the stack.
  // (this can throw on syntax errors!)
  pr = jsparse.parseUntilRightCurly(s, ctx.filename, 1, elideList,
                                    !ctx.rawMode);

  var block = new JSBlock(s.substring(pr.start, pr.end),
                          pr.tokenizer.tokenLog,
                          pr.script);
  if (ctx.rawMode) {
    ctx.tokenRuns.push(new JSTokenRun(block.tokens));
    ctx.curTokenRun = null;
  }
  return [block, pr.end + 1];
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

/**
 * Parse a block of JS code that is not expected to end with an extra squiggly
 *  brace.
 *
 * @args[
 *   @param[s String]{
 *     The JS code to parse.
 *   }
 *   @param[ctx ParserContext]
 * ]
 * @return[JSBlock]
 */
function parse_js_snippet(s, ctx) {
  var pr;
  // this can throw on syntax errors!
  pr = jsparse.parseUntilRightCurly(s, ctx.filename, ctx.line, elideList,
                                    !ctx.rawMode, true);

  var block = new JSBlock(s.substring(pr.start, pr.end),
                          pr.tokenizer.tokenLog,
                          pr.script);
  if (ctx.rawMode) {
    ctx.tokenRuns.push(new JSTokenRun(block.tokens));
    ctx.curTokenRun = null;
  }
  return block;
}

}); // end define
