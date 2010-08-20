/**
 * Renders scribble-syntax source to HTML.
 **/

var self = require("self");

// XXX I just copied these from scribble-syntax...
var AT_SIGN = 0,
    AT_LBRACKET = 1,
    AT_RBRACKET = 2,
    AT_LSQUIGGLE = 3,
    AT_RSQUIGGLE = 4,
    SEXPR_NUMBER = 5,
    SEXPR_STRING = 6,
    SEXPR_IDENTIFIER = 7,
    SEXPR_BOOLEAN = 8,
    SEXPR_KEYWORD = 9,
    ATXPR_COMMENT = 10,
    ATXPR_COMMAND = 11,
    ERRORRE = 12;


var tokToClass = ["xaa", "xab", "xab", "xas", "xas",
                  "xsn", "xss", "xsi", "xsb", "xsk",
                  "xac", "xax", "xer"];

exports.htmlifyTokenRun = function(tokenrun, options) {
  var tokens = tokenrun.tokens;
  if (!("renderer-scribble" in options.namedCssBlocks)) {
    options.namedCssBlocks["renderer-scribble"] = true;
    options.cssBlocks.push(self.data.load("css/syntax-scribble-proton.css"));
  }

  var bits = [];

  function depthChange(x) {
    options.nestingDepth += x;
    if (x < 0)
      return "</span>";
    return "<span class='xd" + options.nestingDepth + "'>";
  }

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (typeof(token) === "string") {
      bits.push(token);
    }
    else if (typeof(token) === "number") {
      switch(token) {
        case AT_SIGN:
          bits.push("<span class='xaa'>@</span>");
          break;
        case AT_LBRACKET:
          bits.push(depthChange(1));
          bits.push("<span class='xab'>[</span>");
          break;
        case AT_RBRACKET:
          bits.push("<span class='xab'>]</span>");
          bits.push(depthChange(-1));
          break;
        case AT_LSQUIGGLE:
          bits.push(depthChange(1));
          bits.push("<span class='xab'>{</span>");
          break;
        case AT_RSQUIGGLE:
          bits.push("<span class='xab'>}</span>");
          bits.push(depthChange(-1));
          break;
      }
    }
    else {
      if (token.type === AT_LBRACKET || token.type === AT_LSQUIGGLE)
        bits.push(depthChange(1));
      bits.push("<span class='" + tokToClass[token.type] + "'>" +
                token.value +
                "</span>");
      if (token.type === AT_RBRACKET || token.type === AT_RSQUIGGLE)
        bits.push(depthChange(-1));
    }
  }

  return bits.join("");
};
