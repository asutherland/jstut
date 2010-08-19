/**
 * Renders scribble-syntax source to HTML.
 **/

exports.htmlifyScribbleRun = function(tokens, options) {
  if (!("renderer-scribble" in options.namedCssBlocks)) {
    options.namedCssBlocks["renderer-scribble"] = true;
    options.cssBlocks.push(self.data.load("css/syntax-scribble-proton.css"));
  }

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

  }
};
