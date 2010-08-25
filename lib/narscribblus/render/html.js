/**
 * HTML output support functionality with (optiona) awareness of the livejection
 *  process.  If the options object does not have a livejecters attribute,
 *  nothing livejection aware happens.
 **/

var RE_AMPER = /&/g;
var RE_LESSTHAN = /</g;
var RE_GREATERTHAN = />/g;
function htmlEscapeText(str, options) {
  return str.replace(RE_AMPER, "&amp;")
            .replace(RE_LESSTHAN, "&lt;")
            .replace(RE_GREATERTHAN, "&gt;");
}
exports.htmlEscapeText = htmlEscapeText;

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
 */
function htmlStreamify(strOrNodes, options) {
  if (strOrNodes == null)
    return "";
  if (typeof(strOrNodes) == "string")
    return htmlEscapeText(strOrNodes, options);

  var ostrs = [];
  for (var i = 0; i < strOrNodes.length; i++) {
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
function htmlDocify(strOrNodes, ctx) {
  var options = ctx.options;
  options.cssBlocks = [];
  options.namedCssBlocks = {};
  options.title = "Narscribblus";

  ctx.fireHook("htmlDocStaticHookup", [options]);

  var bodyString = htmlStreamify(strOrNodes, options);
  var s = "<!DOCTYPE html>\n<html>\n<head><title>" + options.title + "</title>\n";
  s += '<style type="text/css">' + options.cssBlocks.join('\n') + '</style>\n';
  s += "</head>\n<body>\n";
  s += bodyString;
  s += "</body>\n</html>";
  return s;
}
exports.htmlDocify = htmlDocify;


var RE_TAG_EATER = /<[^>]+>/g;
/**
 * Given a string that may have HTML markup in it, try and kill the HTML markup
 *  dead.  We currently accomplish this with a regex that eats tags.
 */
function stripHtml(htmlString) {
  return htmlString.replace(RE_TAG_EATER, "");
}
exports.stripHtml = stripHtml;
