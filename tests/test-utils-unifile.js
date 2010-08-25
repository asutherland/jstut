var FAKE_RESULT =
  '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n' +
  '<html> \n' +
  ' <head> \n' +
  '  <title>Index of /cjs/narscribblus</title> \n' +
  ' </head> \n' +
  ' <body> \n' +
  '<h1>Index of /cjs/narscribblus</h1> \n' +
  '<pre><img src="/icons/blank.gif" alt="Icon "> <a href="?C=N;O=D;F=1">Name</a>                    <a href="?C=M;O=A;F=1">Last modified</a>      <a href="?C=S;O=A;F=1">Size</a>  <a href="?C=D;O=A;F=1">Description</a><hr><img src="/icons/back.gif" alt="[DIR]"> <a href="/cjs/">Parent Directory</a>                             -   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="data/">data/</a>                   04-Aug-2010 23:26    -   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="lib/">lib/</a>                    26-Jul-2010 07:19    -   \n' +
  '<img src="/icons/unknown.gif" alt="[   ]"> <a href="package.json">package.json</a>            03-Aug-2010 18:30  214   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="packages/">packages/</a>               03-Aug-2010 18:41    -   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="tests/">tests/</a>                  20-Aug-2010 23:45    -   \n' +
  '<img src="/icons/folder.gif" alt="[DIR]"> <a href="web/">web/</a>                    11-Aug-2010 05:01    -   \n' +
  '<hr></pre> \n' +
  '<address>Apache/2.2.15 (Fedora) Server at depeche Port 80</address> \n' +
  '</body></html> \n';
var EXPECTED_RESULT = ["data/", "lib/", "package.json", "packages/", "tests/",
                       "web/"];

function mockXHR(result, statusCode) {
  var funk = function() {
    this.responseText = result;
    this.callback = null;
    this.status = (statusCode === undefined) ? 200 : statusCode;
  };
  funk.prototype = mockXHR_prototype;
  return funk;
}
var mockXHR_prototype = {
  open: function(method, url, async) {
    if (method !== "GET")
      throw new Error("I am a lazy fake; GET or death");
    if (!async)
      throw new Error("I am a lazy fake; async or death");
  },
  addEventListener: function(eventName, callback, ignoredCapture) {
    if (eventName !== "load")
      throw new Error(eventName + " is a stupid thing to listen for.");
    this.callback = callback;
  },
  // XXX we should really defer via the event loop or a timer...
  send: function(ignoredData) {
    this.callback();
  },
};

/**
 * Test the list by making a fake xhr that just returns that thing up there.
 */
exports.testWebList = function(test) {
  var loader = test.makeSandboxedLoader({
    moduleOverrides: {
      xhr: {
        XMLHttpRequest: mockXHR(FAKE_RESULT),
      },
    },
  });
  var gotAResult = false;
  loader.require("narscribblus/utils/unifile")
        .list("http://banana.banana/", function(items) {
    test.assertEqual(items.toString(), EXPECTED_RESULT.toString());
    gotAResult = true;
  });
  test.assert(gotAResult, "got a result");
};

/**
 * The local file thing also needs to work the same way.  Because we do not
 *  expect our package to remain static and don't want to have to constantly
 *  remaster this test, we just look for specific expected results.
 */
var url = require("url");
var self = require("self");
exports.testLocalList = function(test) {
  var unifile = require("unifile");
  var path = url.toFilename(self.data.url("../"));
  var results;
  unifile.list(path, function (items) {
    results = items;
  });

}
