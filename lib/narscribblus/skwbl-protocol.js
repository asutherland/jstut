
/**
 * A sham protocol which exists exclusively so we can have a chrome principle.
 *  The filename doubles as the hostname and is only instantiated on a call to
 *  makeDocURI.  As per the general idiom, we build data URIs.  It would be nice
 *  if we could use a stream since we may start producing larger documents.
 **/

var protocol = require("custom-protocol").register("skwbl");

var loader = require("narscribblus/scribble-loader");

exports.makeDocURI = function(aData, aFilename, aOptions) {
  // load the raw string
  var parseOutput = loader.parseDocument(aData, aFilename, aOptions);

  var normalizedName = aFilename.replace("/", "-");

  var dataUrl = "data:text/html," + encodeURI(parseOutput.body);
  protocol.setHost(normalizedName, dataUrl, "system");
  return {
    url: "skwbl://" + normalizedName + "/",
    processed: parseOutput,
  };
};
