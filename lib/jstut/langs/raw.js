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

/**
 * Just syntax highlight the raw document.  To make sure we get all the right
 *  readers we import the 'detected' lang type and steal its readers.  At some
 *  point we will also be able to provide information on what the various
 *  at-commands do by stealing its function map.  But not right now.
 **/

define("jstut/langs/raw",
  [
    "exports",
    "jstut/readers/scribble-syntax",
    "jstut/langs/manual",
    "jstut/utils/pwomise",
    // force this to be loaded since we expect to need it, but strictly speaking
    //  it might be better to have the langs that use it require it or name it
    //  more directly.
    "jstut/render/scribble",
  ],
  function (
    exports,
    syn,
    man,
    pwomise,
    render_scribble
  ) {

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

  var deferred = pwomise.defer("requireLang", langName);

  require([langBits[0] + "/langs/" + langBits.slice(1).join("/")],
      function (origLang) {
    ctx.slurpModuleContributions(origLang);

    // - parse parse parse!
    // XXX If we cared about alternate top-level source things we would have
    //  the language convey what their root reader context is and then use that.
    //  We may want to do that shortly for JS source with syntax highlighted and
    //  magic jstut syntax.

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
    deferred.resolve(ctx.tokenRuns);
  });

  return deferred.promise;
};

/**
 * No expansion happens.
 */
exports.expand = function expand(nodes, ctx) {
  return nodes;
};

/**
 * Processing phase consists of rendering consecutive runs of tokens (which
 *  were broken up by changes in active readers).
 */
exports.process = function process(tokenRuns, ctx) {
  var options = ctx.options, i;
  options.inPreSyntaxBlock = true;
  options.cssBlocks = [];
  options.cssUrls = [];
  options.namedCssBlocks = {};
  options.title = ctx.filename;
  options.nestingDepth = 0;

  var renderers = {};

  var bits = ["<pre class='syntax'>"];
  for (i = 0; i < tokenRuns.length; i++) {
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
  for (i = 0; i < options.cssUrls.length; i++) {
    s += '<link rel="stylesheet" type="text/css" href="' + options.cssUrls[i] +
         '">\n';
  }
  s += "</head>\n<body>\n";
  s += bits.join("");
  s += "</body>\n</html>";
  return {
    body: s,
    liveject: null,
  };
};

}); // end define
