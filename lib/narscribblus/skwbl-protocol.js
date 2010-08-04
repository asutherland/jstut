
/**
 * A sham protocol which exists exclusively so we can have a chrome principle.
 *  The filename doubles as the hostname and is only instantiated on a call to
 *  makeDocURI.  As per the general idiom, we build data URIs.  It would be nice
 *  if we could use a stream since we may start producing larger documents.
 **/

var protocol = require("custom-protocol").register("skwbl");

var loader = require("narscribblus/scribble-loader");
var self = require("self");


exports.makeDocURI = function(aFilename, aOptions) {
  // load the raw string
  var s = self.data.load(aFilename);
  var parseOutput = loader.parseDocument(s, aFilename, aOptions);

  var normalizedName = aFilename.replace("/", "-");

  var dataUrl = "data:text/html," + parseOutput.body;
  protocol.setHost(normalizedName, dataUrl, "system");
  return {
    url: "skwbl://" + normalizedName + "/",
    processed: parseOutput,
  };
};
