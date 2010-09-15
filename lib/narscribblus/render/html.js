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
 * HTML output support functionality with (optiona) awareness of the livejection
 *  process.  If the options object does not have a livejecters attribute,
 *  nothing livejection aware happens.
 **/

require.def("narscribblus/render/html",
  [
    "exports",
  ],
  function (
    exports
  ) {

var RE_AMPER = /&/g;
var RE_LESSTHAN = /</g;
var RE_GREATERTHAN = />/g;
function htmlEscapeText(str, options) {
  if (typeof(str) !== "string")
    str = "" + str;
  return str.replace(RE_AMPER, "&amp;")
            .replace(RE_LESSTHAN, "&lt;")
            .replace(RE_GREATERTHAN, "&gt;");
}
exports.htmlEscapeText = htmlEscapeText;

/**
 * @protocol[HtmlNode]
 */
var HtmlNode = {
  /**
   *
   * @args[
   *   @param[options @dict[
   *     @key[cssBlocks @listof["css string"]]{
   *       An array of CSS strings.
   *     }
   *     @key[namedCssBlocks @dictof]{
   *     }
   *     @key[title String]{
   *       The title of the resulting document.
   *     }
   *   ]]
   * ]
   * @return[String]{
   *   A string to insert in the HTML output stream verbatim.  If you have
   *   things that need to be escaped, escape them with @xref{htmlEscape}.
   * }
   */
  toHTMLString: function(options) {
  }
};

/**
 * Helper function to stringify a list of objects, preferring use of a
 *  toHTMLString method when available over toString.  When primitives are
 *  encountered they are stringified sanely.
 *
 * When operating in livejection-aware mode ("livejecters" exists on options),
 *  if we are processing an object and it has a "oneOffLivejecter" attribute on
 *  it, we will insert the value (a livejecter function) into the list of
 *  livejecters if it's the first time we've seen an object of that type before
 *  (based on constructor name only).  This could eventually lead to more
 *  easily being able to splice livejection logic into an output document,
 *  eliminating the need for a bootstrap document/process.  (OTOH, it's not
 *  clear when we would really need that right now.)
 *
 * @args[
 *   @param[strOrNodes @oneof[String @listof[HtmlNode]]]
 *   @param[options]
 *   @param[delimiter #:optional]
 * ]
 */
function htmlStreamify(strOrNodes, options, delimiter) {
  if (strOrNodes == null)
    return "";
  if (typeof(strOrNodes) == "string")
    return htmlEscapeText(strOrNodes, options);

  var ostrs = [];
  for (var i = 0; i < strOrNodes.length; i++) {
    if (i)
      ostrs.push(delimiter);
    var node = strOrNodes[i];
    if (typeof(node) !== "object") {
      ostrs.push(node.toString());
    }
    else {
      if ("toHTMLString" in node) {
        if ("livejecters" in options && "oneOffLivejecter" in node) {
          // (we are assuming oneOffLivejectersSeen is also in options)
          if (!(node.oneOffLivejecter.constructor.name in
                options.oneOffLivejectersSeen)) {
            options.oneOffLivejectersSeen[
              node.oneOffLivejecter.constructor.name] = true;
            options.livejecters.push(node.oneOffLivejecter);
          }
        }
        ostrs.push(node.toHTMLString(options));

      }
      else {
        ostrs.push(htmlEscapeText(node.toString(), options));
      }
    }
  }
  return ostrs.join("");
}
exports.htmlStreamify = htmlStreamify;

/**
 * Convert an expanded list of objects into an HTML document.  This is a 2-pass
 *  operation.  We streamify the objects and then use the contents of options
 *  to help build the rest of the document.
 *
 * The ad hoc collaboration through options, especially having it named options,
 *  is not sitting well with me right now, but we can refactor it if this
 *  project has legs once things are usably worky.
 *
 * Currently the fields are:
 * - cssBlocks: A list of strings that are joined with newlines and crammed into
 *    a style block.
 */
function htmlDocify(strOrNodes, ctx, initialCssUrls) {
  var options = ctx.options, i;
  options.cssBlocks = [];
  options.cssUrls = initialCssUrls || [];
  options.namedCssBlocks = {};
  options.title = ctx.filename;

  ctx.fireHook("htmlDocStaticHookup", [options]);

  var bodyString = htmlStreamify(strOrNodes, options);
  var s = "<!DOCTYPE html>\n<html>\n<head><title>" + options.title + "</title>\n";
  s += '<style type="text/css">' + options.cssBlocks.join('\n') + '</style>\n';
  for (i = 0; i < options.cssUrls.length; i++) {
    s += '<link rel="stylesheet" type="text/css" href="' + options.cssUrls[i] +
         '">\n';
  }
  s += "</head>\n<body>\n";
  s += bodyString;
  s += "</body>\n</html>";
  return s;
}
exports.htmlDocify = htmlDocify;

exports.simpleDoc = function(title, bodyString) {
  var s = "<!DOCTYPE html>\n<html>\n<head><title>" + title + "</title>\n";
  s += "</head>\n<body>\n";
  s += bodyString;
  s += "</body>\n</html>";
  return s;
};

var RE_TAG_EATER = /<[^>]+>/g;
/**
 * Given a string that may have HTML markup in it, try and kill the HTML markup
 *  dead.  We currently accomplish this with a regex that eats tags.
 */
function stripHtml(htmlString) {
  return htmlString.replace(RE_TAG_EATER, "");
}
exports.stripHtml = stripHtml;

}); // end require.def
