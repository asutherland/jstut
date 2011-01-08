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

define(
  [
    "narscribblus/narcissus/jsparse",
    "narscribblus/narcissus/jsdefs",
    "exports"
  ],
  function(
    $jsparse,
    $jsdefs,
    exports
  ) {


var tokenIds = $jsdefs.tokenIds;

const STRING = tokenIds["STRING"],
      COMMENT_LINE = tokenIds["COMMENT_LINE"],
      COMMENT_BLOCK = tokenIds["COMMENT_BLOCK"];

/** The legal token types recognized by the ACE themes right now. */
var allowedClasses = {
  "comment": true,
  "string.regexp": true,
  "string": true,
  "constant.numeric": true,
  "constant.language.boolean": true,
  "variable.language": true,
  "keyword": true,
  "constant.language": true,
  "invalid.illegal": true,
  "invalid.deprecated": true,
  "identifier": true,
  "keyword.operator": true,
  "lparen": true,
  "rparen": true,
  "text": true,
  "comment.doc": true,
};

/**
 * Token mappings based on render/js largely converted
 */
var cssClassSourceTokens = {
  "comment.elided": ["ELIDED"],

  // -- comments
  comment: ["COMMENT_BLOCK", "COMMENT_LINE"],

  // -- keywords
  // - control flow
  "keyword.conditional":
    ["BREAK", "CASE", "CONTINUE", "DEFAULT", "ELSE", "IF", "SWITCH"],
  "keyword.loop": ["DO", "FOR", "WHILE"],

  // - function decls
  "keyword.function": ["FUNCTION"],

  // - exception handling
  "keyword.errhandling": ["CATCH", "FINALLY", "THROW", "TRY"],

  // - variable declaration
  "keyword.vardecl": ["CONST", "LET", "VAR", "WITH"],

  // - variable nuking
  "operator.nuking": ["NEW", "DELETE"],

  // - value returning
  "keyword.return": ["YIELD", "RETURN"],

  // - magic
  "invalid.deprecated": ["DEBUGGER"],
  "variable.language": ["THIS"],

  // - reserved / unused
  "invalid.illegal": ["ENUM", "VOID"],


  // - boolean literals
  "constant.language.boolean": ["FALSE", "TRUE"],
  // - null/undefined
  "constant.language": ["NULL"], // no undefined right now?

  // -- punctuation
  // - boring
  "keyword.operator.semicolon": ["SEMICOLON"],
  "keyword.operator.comma": ["COMMA"],

  lparen: ["LEFT_BRACKET", "LEFT_CURLY", "LEFT_PAREN"],
  rparen: ["RIGHT_BRACKET", "RIGHT_CURLY", "RIGHT_PAREN"],

  // -- operators
  "keyword.operator.type": ["IN", "INSTANCEOF", "TYPEOF"],

  "keyword.operator.dot": ["DOT"],

  // - interesting
  "keyword.operator": ["OR", "AND", "BITWISE_OR", "BITWISE_XOR", "BITWISE_AND",
      "URSH", "RSH", "PLUS", "MINUS", "MUL", "DIV", "MOD",],

  // - comparators
  "keyword.operator.comparator":
    ["STRICT_EQ", "EQ", "STRICT_NE", "NE", "GE", "GT"],
  // - mutating
  "keyword.operator.assignment": ["ASSIGN"],
  // - inc/dec
  "keyword.operator.incdec": ["INCREMENT", "DECREMENT"],

  // - unary
  "keyword.operator.unary": ["UNARY_PLUS", "UNARY_MINUS",
       "NOT", "BITWISE_NOT"],

  // - ternary
  "keyword.operator.ternary": ["HOOK", "COLON"],

  "identifier": ["IDENTIFIER"],
  "constant.numeric": ["NUMBER"],
  "string": ["STRING"],
  "string.regexp": ["REGEXP"],
};

var tokenIdToAceType = {};
function buildTokenToCssMap() {
  for (var cssClass in cssClassSourceTokens) {
    var tokenNames = cssClassSourceTokens[cssClass];
    // If the cssClass is not allowed, trim off the rightmost ellipsis thing
    //  and repeat the check.  If there is nothing to trim, just use it as-is.
    while (!(cssClass in allowedClasses) && cssClass.indexOf(".") != -1) {
      var classBits = cssClass.split(".");
      classBits = classBits.slice(0, classBits.length - 1);
      cssClass = classBits.join(".");
    }
    for (var i = 0; i < tokenNames.length; i++) {
      tokenIdToAceType[tokenIds[tokenNames[i]]] = cssClass;
    }
  }
}
buildTokenToCssMap();


/**
 * A "tokenizer" that harnesses the awesome power of jstut and narcissus to
 *  actually parse the javascript code and provide exciting results back.
 *
 */
function JstutTokenizer(fallbackTokenizer) {
  this.tokenLines = [];
  this.fallbackTokenizer = fallbackTokenizer;
}
JstutTokenizer.prototype = {
  wholeDocumentParser: true,

  /**
   *
   * @args[
   *   @param[lines]
   * ]
   * @return[@dict[
   *   @key[firstBadLine Number]{
   *     The first line that the parser failed to process.
   *   }
   * ]]
   */
  parse: function(lines) {
    var programText = lines.join("\n");

    try {
      var parsed = $jsparse.parseUntilRightCurly(
                     programText, "#skywriter#", 1, null,
                     false, // no need to normalize whitespace
                     true // do not kill excise the right curly
                   );
      // it's possible an extra right curly could kill us prematurely.  treat
      //  that as a failure.
      if (parsed.tokenizer.cursor != programText.length) {
        console.error("Should have parsed up everything but cursor:",
                      parsed.tokenizer.cursor, "with program length:",
                      programText.length);
      }

      // break the tokens out into lines.
      var tokenLog = parsed.tokenizer.tokenLog;
      var curLine = [];
      var tokenLines = this.tokenLines = [curLine];
      for (var i = 0; i < tokenLog.length; i++) {
        var token = tokenLog[i];
        // fastpath newline
        if (token === "\n") {
          curLine = [];
          tokenLines.push(curLine);
        }
        // pure string...
        else if (typeof(token) === "string") {
          // it might end in a newline, in which case slice and handle
          if (token[token.length - 1] === "\n") {
            curLine.push(token.substring(0, token.length - 1));
            curLine = [];
            tokenLines.push(curLine);
          }
          else {
            curLine.push(token);
          }
        }
        // COMMENT_LINE implies a newline...
        else if (token.type === COMMENT_LINE) {
          curLine.push(token);
          curLine = [];
          tokenLines.push(curLine);
        }
        // comment blocks can have newlines in them; we need to fragment
        else if (token.type === COMMENT_BLOCK) {
          var blockBits = token.value.split("\n");
          curLine.push({type: COMMENT_BLOCK,
                        value: "/*" + blockBits[0]});
          for (var iBlockBit = 1; iBlockBit < blockBits.length; iBlockBit++) {
            curLine = [{type: COMMENT_BLOCK,
                        value: blockBits[iBlockBit]}];
            tokenLines.push(curLine);
          }
          curLine[curLine.length - 1].value += "*/";
        }
        else {
          curLine.push(token);
        }
      }

      if (tokenLines.length != lines.length) {
        console.warn("parsed line count:", tokenLines.length,
                     "input line count:", lines.length);
      }

      return {
        firstBadLine: tokenLines.length,
      };
    }
    catch(ex) {
      // for now, treat all parse failures as complete failures
      this.tokenLines = [];
      return {
        firstBadLine: 0,
      };
    }
  },

  /**
   * Synchronously convert parsed token lines into the ACE TokenLine
   *  representation.
   *
   * @return[TokenizedLine]
   * ]]
   */
  getLineTokens: function(iLine, startState) {
    var jsTokens = this.tokenLines[iLine];
    var outTokens = [];
    for (var i = 0; i < jsTokens.length; i++) {
      var token = jsTokens[i];
      var type, value;

      if (typeof(token) === "string") {
        value = token;
        type = "text";
      }
      else {
        type = tokenIdToAceType[token.type];
        if ("str" in token)
          value = token.str;
        else if (token.type === STRING)
          value = token.quoteChar + token.value + token.quoteChar;
        else if (token.type === COMMENT_LINE)
          value = "//" + token.value;
        // we already put the /* */ stuff in for COMMENT_BLOCK when we
        //  fragmented them into COMMENT_BLOCK_FRAGMENT so nothing to do now.
        else
          value = token.value;
      }

      outTokens.push({
        type: type,
        value: value,
      });
    }

    return {
      tokens: outTokens,
      state: "awesome",
    };
  },
};
exports.JstutTokenizer = JstutTokenizer;

}); // end require.def
