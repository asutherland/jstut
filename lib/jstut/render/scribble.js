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
 * Renders scribble-syntax source to HTML.
 **/

define("jstut/render/scribble",
  [
    "exports",
    "jstut-plat/package-info",
  ],
  function(
    exports,
    pkginfo
  ) {

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
    options.cssUrls.push(
      pkginfo.dataDirUrl("jstut/css/syntax-scribble-proton.css"));
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

}); // end define
