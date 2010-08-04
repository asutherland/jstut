var loader = require("narscribblus/scribble-loader");
var uglyproto = require("narscribblus/skwbl-protocol");
var xulapp = require("xul-app");

var self = require("self");

function showWhereYouCan(aFilename) {
  var options = {

  };
  var info = uglyproto.makeDocURI(aFilename, options);
  if (xulapp.is("Firefox")) {
    var tabs = require("tabs");
    console.log("spawning tab.");
    tabs.open({
      url: info.url,
      onOpen: function(tab) {
        var doc = tab.contentDocument;
        // perform the liveject if desired
        if (info.processed.liveject)
          info.processed.liveject(doc, tab.contentWindow);
      },
    });
  }
  else {
    var contentWindow = require("narscribblus/opc/content-window");
    var window = new contentWindow.Window({
      url: info.url,
      width: 1100, height: 1000,
      onStartLoad: function(win) {
        var doc = win.document;
        if (info.processed.liveject)
          info.processed.liveject(doc, win);
      }
    });
  }
}

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

  // parse a skwbl file and dump its processed result to stdout
  if (args[0] == "parse") {
    var s = self.data.load(args[1]);
    dump(loader.parseDocument(s, args[1]).body);
    return callbacks.quit("OK");
  }

  // show a skwbl file in a chrome tab
  if (args[0] == "show") {
    showWhereYouCan(args[1]);
    return undefined;
  }

  return callbacks.quit("FAIL");
};
