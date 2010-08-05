/**
 * Concerned with rendering JS code and things that looks like JS code.
 **/
var self = require("self");

var Fragment = require("narscribblus/manual-lang").Fragment;

var cssClassSourceTokens = {
  // -- comments
  c: [],

  // -- keywords
  // - control flow
  kc: ["BREAK", "CASE", "CONTINUE", "DEFAULT", "DO", "ELSE", "FOR", "IF",
       "SWITCH"],

  // - function decls
  kf: ["FUNCTION"],

  // - exception handling
  ke: ["CATCH", "FINALLY", "THROW", "TRY"],

  // - variable declaration
  kv: ["CONST", "LET", "VAR", "WITH"],

  // - variable nuking
  kn: ["DELETE"],

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

var tokenNameToCssClass = {};
function buildTokenToCssMap() {
  for (var cssClass in cssClassSourceTokens) {
    var tokenNames = cssClassSourceTokens[cssClass];
    for (var i = 0; i < tokenNames.length; i++) {
      tokenNameToCssClass[tokenNames[i]] = cssClass;
    }
  }
}
buildTokenToCssMap();

exports.htmlifyJSBlock = function htmlifyJSBlock(block, options) {
  if (!("renderer-js" in options.namedCssBlocks)) {
    options.namedCssBlocks["renderer-js"] = true;
    options.cssBlocks.push(self.data.load("css/syntax-js-rdark.css"));
  }

  var bits = [];

  var tokens = block.tokens;
  for (var i = 0; i < tokens.length; i++) {

  }

  return "<pre>" + bits.join("") + "</pre>";
};

exports.narscribblusExecFuncs = {
  sjskeyword: function(name, svals, tvals, ctx) {
    return new Fragment(tvals);
  },
};
