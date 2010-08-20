/**
 * Renders scribble-syntax source to HTML.
 **/

var tokToClass = ["xaa", "xab", "xab", "xas", "xas",
                  "xsn", "xss", "xsi", "xsb", "xsk",
                  "xac", "xax"];

exports.htmlifyScribbleRun = function(tokens, options) {
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
      return token;
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

    }
  }
};
