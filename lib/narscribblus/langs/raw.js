/**
 * Just syntax highlight the raw document.  To make sure we get all the right
 *  readers we import the 'detected' lang type and steal its readers.  At some
 *  point we will also be able to provide information on what the various
 *  at-commands do by stealing its function map.  But not right now.
 **/

var syn = require("narscribblus/readers/scribble-syntax");
var man = require("narscribblus/langs/manual");

/**
 * Parse phase happens like usual except:
 * @itemize[
 *   @item{we load the original lang type to get at its readers}
 *   @item{we only care about the token runs}
 * ]
 */
exports.parse = function parse(s, ctx) {
  // - load original lang type and steal its readers
  var langName = ctx.options.detectedLang;
  var langBits = langName.split("/");
  var origLang = require(langBits[0] + "/langs/" + langBits[1]);
  ctx.slurpModuleContributions(origLang);

  // - parse parse parse!
  // XXX If we cared about alternate top-level source things we would have
  //  the language convey what their root reader context is and then use that.
  //  We may want to do that shortly for JS source with syntax highlighted and
  //  magic narscribblus syntax.

  ctx.rawMode = true;
  ctx.tokenRuns = [];
  var breakerResults;
  try {
    breakerResults = syn.textStreamAtBreaker(s, ctx);
  }
  catch (ex) {
    // parsing exceptions are fine...
    console.warn("Parsing exception observed but irrelevant", ex);
  }
  return ctx.tokenRuns;
};

/**
 * No expansion happens.
 */
exports.expand = function expand(nodes, ctx) {
  return nodes;
};

// teleport is not magic; someone needs to feed its regex...
require("narscribblus/render/js");
require("narscribblus/render/scribble");

/**
 * Processing phase consists of rendering consecutive runs of tokens (which
 *  were broken up by changes in active readers).
 */
exports.process = function process(tokenRuns, ctx) {
  var options = ctx.options;
  options.inPreSyntaxBlock = true;
  options.cssBlocks = [];
  options.namedCssBlocks = {};
  options.title = ctx.filename;
  options.nestingDepth = 0;

  var renderers = {};

  var bits = ["<pre class='syntax'>"];
  for (var i = 0; i < tokenRuns.length; i++) {
    var run = tokenRuns[i];
    var renderer;
    if (!(run.renderModule in renderers)) {
      renderers[run.renderModule] = renderer =
        require(run.renderModule).htmlifyTokenRun;
    }
    else {
      renderer = renderers[run.renderModule];
    }
    bits.push(renderer(run, ctx.options));
  }
  bits.push("</pre>");
  var s = "<!DOCTYPE html>\n<html>\n<head><title>" + options.title +
    "</title>\n";
  s += '<style type="text/css">' + options.cssBlocks.join('\n') + '</style>\n';
  s += "</head>\n<body>\n";
  s += bits.join("");
  s += "</body>\n</html>";
  return {
    body: s,
    liveject: null,
  };
};
