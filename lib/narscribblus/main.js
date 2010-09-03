var loader = require("narscribblus/scribble-loader");
var uglyproto = require("narscribblus/skwbl-protocol");
var xulapp = require("xul-app");

var self = require("self");

/**
 * Create some form of browser tab/window in which to display our narscribblus
 *  document and then show it there.
 * While we may display it in a Firefox tab, the reality is that it is not a
 *  web page and people expecting it to behave like one in terms of back /
 *  refresh / forward will end up sad.  The initial rationale for this (it was
 *  an unprivileged document) became moot some time ago so transitioning to
 *  a chrome document that bootstraps itself (like our web loader) into life
 *  could be sane.  The only problem is such a thing will either need to perform
 *  self-immolation/replacement or use an iframe (like our web loader).  And
 *  since Thunderbird will end up with tabs that don't look like web browser
 *  tabs, it's not as much of an issue there.
 */
function showWhereYouCan(aData, aFilename) {
  var options = {
    makeDocLink: function(aDocPath, aCitingPackageName) {
      aDocPath = aCitingPackageName + "/" + aDocPath;
      return ' href="' +
        "javascript:alert('second-class platform for now. :(')" +
        '"';
    }
  };
  uglyproto.makeDocURI(aData, aFilename, options, showGotContents);
}
exports.showWhereYouCan = showWhereYouCan;
function showGotContents(info) {
  if (xulapp.is("Firefox")) {
    var tabs = require("tabs");
    console.log("spawning tab.");
    tabs.open({
      url: info.url,
      onOpen: function(tab) {
        tabForThisClosure = tab;
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
    loader.parseDocument(s, args[1], {}, function(results) {
      dump(results.body);
      callbacks.quit("OK");
    });
    return undefined;
  }

  if (args[0] == "nullparse") {
    var s = self.data.load(args[1]);
    loader.parseDocument(s, args[1], {}, function(results) {
      callbacks.quit("OK");
    });
    return undefined;
  }

  // show a skwbl file in a chrome tab
  if (args[0] == "show") {
    showWhereYouCan(self.data.load(args[1]), args[1]);
    return undefined;
  }

  return callbacks.quit("FAIL");
};
