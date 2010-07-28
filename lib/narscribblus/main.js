var loader = require("narscribblus/scribble-loader");
var self = require("self");

exports.main = function geckgrok_main(options, callbacks) {
  var args = options.cmdline;
  // so, let's not rewrite getopt.  I'm sure one exists, but let's just be
  //  very very very ugly for now.
  if (args === undefined) {
    console.error("You need to use the hacked up harness driver!");
    return callbacks.quit("FAIL");
  }

  if (args.length == 0) {
    console.error("Specify a command.");
    return callbacks.quit("FAIL");
  }

  if (args[0] == "parse") {
    var s = self.data.load(args[1]);
    loader.parseDocument(s, args[1]);
    return callbacks.quit("OK");
  }

  return callbacks.quit("FAIL");
};
