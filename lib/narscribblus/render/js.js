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

define("narscribblus/render/js",
  [
    "exports",
    "narscribblus-plat/package-info",
    "narscribblus/narcissus/jsdefs",
    "narscribblus/langs/manual",
    "narscribblus/render/html",
    "narscribblus/traverser",
  ],
  function (
    exports,
    pkginfo,
    jsdefs,
    man,
    html,
    traverser_mod
  ) {

/**
 * Concerned with rendering JS code and things that looks like JS code.
 **/
var tokenIds = jsdefs.tokenIds;
var Fragment = man.Fragment;
var htmlEscapeText = html.htmlEscapeText;
var SynTraverser = traverser_mod.SynTraverser;

var cssClassSourceTokens = {
  e: ["ELIDED"],

  // -- comments
  c: ["COMMENT_BLOCK", "COMMENT_LINE"],

  // -- keywords
  // - control flow
  kc: ["BREAK", "CASE", "CONTINUE", "DEFAULT", "ELSE", "IF", "SWITCH"],
  kl: ["DO", "FOR", "WHILE"],

  // - function decls
  kf: ["FUNCTION"],

  // - exception handling
  ke: ["CATCH", "FINALLY", "THROW", "TRY"],

  // - variable declaration
  kv: ["CONST", "LET", "VAR", "WITH"],

  // - variable nuking
  kn: ["NEW", "DELETE"],

  // - value returning
  kr: ["YIELD", "RETURN"],

  // - magic
  km: ["DEBUGGER"],
  kt: ["THIS"],

  // - reserved / unused
  kx: ["ENUM", "VOID"],


  // - boolean literals
  kb: ["FALSE", "TRUE"],
  // - null/undefined
  ku: ["NULL"], // no undefined right now?

  // -- punctuation
  // - boring
  ps: ["SEMICOLON"],
  pb: ["COMMA"],

  pr: ["LEFT_BRACKET", "RIGHT_BRACKET"],
  pc: ["LEFT_CURLY", "RIGHT_CURLY"],
  pp: ["LEFT_PAREN", "RIGHT_PAREN"],
  // synthetic, the quote character for strings...
  pq: [],

  // -- operators
  ok: ["IN", "INSTANCEOF", "TYPEOF"],

  od: ["DOT"],

  // - interesting
  o: ["OR", "AND", "BITWISE_OR", "BITWISE_XOR", "BITWISE_AND",
      "URSH", "RSH", "PLUS", "MINUS", "MUL", "DIV", "MOD",],

  // - comparators
  oc: ["STRICT_EQ", "EQ", "STRICT_NE", "NE", "GE", "GT"],
  // - mutating
  om: ["ASSIGN"],
  // - inc/dec
  omu: ["INCREMENT", "DECREMENT"],

  // - unary
  ou: ["UNARY_PLUS", "UNARY_MINUS",
       "NOT", "BITWISE_NOT"],

  // - ternary
  ot: ["HOOK", "COLON"],

  i: ["IDENTIFIER"],
  n: ["NUMBER"],
  s: ["STRING"],
  r: ["REGEXP"],
};

var tokenIdToCssClass = {};
function buildTokenToCssMap() {
  for (var cssClass in cssClassSourceTokens) {
    var tokenNames = cssClassSourceTokens[cssClass];
    for (var i = 0; i < tokenNames.length; i++) {
      tokenIdToCssClass[tokenIds[tokenNames[i]]] = cssClass;
    }
  }
}
buildTokenToCssMap();

const STRING = tokenIds["STRING"],
      COMMENT_LINE = tokenIds["COMMENT_LINE"],
      COMMENT_BLOCK = tokenIds["COMMENT_BLOCK"],
      IDENTIFIER = tokenIds["IDENTIFIER"];

var traverser = new SynTraverser();

/**
 * HTMLify a block of JS code by building up an HTML string.  This is half
 *  because the code was originally written this way and half because I
 *  suspect that it's likely much more performant to do the string building
 *  rather than pay the native-crossing cost.  Revisit as appropriate based
 *  on actual performance data and security concerns.
 *
 * Because we may want to 'linkify' some parts of the syntax and we are not
 *  binding into the DOM directly (which would let us set JS attributes on
 *  the DOM nodes), we also may populate a linkmap that maps
 *  unique-within-this-block strings set on the "u" attribute to other JS
 *  objects.  This is intended for use in the wmsy binding as a one-way-mapping
 *  from DOM node to linked object and not back the other way.
 */
exports.htmlifyJSBlock = function htmlifyJSBlock(block, options) {
  var bits = [];
  var oneUp = 0, linkmap = {};

  var hlTerms;
  if (("highlightTerms" in options) && options.highlightTerms)
    hlTerms = options.highlightTerms;
  var linkify = false;
  if ("linkifySyntax" in options)
    linkify = options.linkifySyntax;

  var tokens = block.tokens;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    if (typeof(token) === "string") {
      bits.push(token);
      continue;
    }
    var ttype = token.type;

    var linked = false;
    if (linkify) {
      var docInfo = traverser.traverse(token);
      if (docInfo) {
        linked = true;
        var oneUpId = "" + oneUp++;
        bits.push("<a class='link'" +
                  " u='" + oneUpId + "'" +
                  ">");
        linkmap[oneUpId] = docInfo;
      }
    }

    if (ttype === STRING) {
      bits.push('<span class="pq">' + token.quoteChar +
                '</span><span class="s">' + htmlEscapeText(token.value) +
                '</span><span class="pq">' + token.quoteChar + '</span>');
    }
    else if (ttype === COMMENT_LINE){
      bits.push('<span class="c">//' + htmlEscapeText(token.value) +
                '</span>\n');
    }
    else if (ttype === COMMENT_BLOCK) {
      bits.push('<span class="c">/*' + htmlEscapeText(token.value) +
                '*/</span>');
    }
    else {
      var tclass = tokenIdToCssClass[token.type];
      if (ttype === IDENTIFIER && hlTerms && hlTerms.indexOf(token.value) != -1)
        tclass += " hl";
      bits.push('<span class="' + tclass + '">' +
                htmlEscapeText(("str" in token) ? token.str : token.value) +
                '</span>');
    }

    if (linked) {
      bits.push("</a>");
    }
  }

  var htmlString;
  if ("inPreSyntaxBlock" in options && options.inPreSyntaxBlock)
    htmlString = bits.join("");
  else
    htmlString = "<pre class='syntax'>" + bits.join("") + "</pre>\n";

  return {html: htmlString, linkmap: linkmap};
};

exports.htmlifyTokenRun = exports.htmlifyJSBlock;

exports.narscribblusExecFuncs = {
  sjskeyword: function(name, svals, tvals, ctx) {
    return new Fragment(tvals);
  },
};

}); // end define
