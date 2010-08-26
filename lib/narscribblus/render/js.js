/**
 * Concerned with rendering JS code and things that looks like JS code.
 **/
var self = require("self");
var tokenIds = require("narscribblus/narcissus/jsdefs").tokenIds;

var Fragment = require("narscribblus/langs/manual").Fragment;

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
      COMMENT_BLOCK = tokenIds["COMMENT_BLOCK"];

exports.htmlifyJSBlock = function htmlifyJSBlock(block, options) {
  if (!("renderer-js" in options.namedCssBlocks)) {
    options.namedCssBlocks["renderer-js"] = true;
    options.cssBlocks.push(self.data.load("css/syntax-js-proton.css"));
  }

  var bits = [];

  //dump("BLOCK!!!!!!\n");
  var tokens = block.tokens;
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    //dump("TOKEN: " + JSON.stringify(token) + "\n");
    if (typeof(token) === "string") {
      bits.push(token);
    }
    else if (token.type === STRING) {
      bits.push('<span class="pq">' + token.quoteChar +
                '</span><span class="s">' + token.value +
                '</span><span class="pq">' + token.quoteChar + '</span>');
    }
    else if (token.type === COMMENT_LINE){
      bits.push('<span class="c">//' + token.value + '</span>\n');
    }
    else if (token.type === COMMENT_BLOCK) {
      bits.push('<span class="c">/*' + token.value + '*/</span>');
    }
    else {
      bits.push('<span class="' + tokenIdToCssClass[token.type] + '">' +
                (("str" in token) ? token.str : token.value) +
                '</span>');
    }
  }

  if ("inPreSyntaxBlock" in options && options.inPreSyntaxBlock)
    return bits.join("");
  else
    return "<pre class='syntax'>" + bits.join("") + "</pre>\n";
};

exports.htmlifyTokenRun = exports.htmlifyJSBlock;

exports.narscribblusExecFuncs = {
  sjskeyword: function(name, svals, tvals, ctx) {
    return new Fragment(tvals);
  },
};
