var syn = require("narscribblus/scribble-syntax");
var loader = require("narscribblus/scribble-loader");

var js_simpleFunc = "function foo() {}";
var js_funcWithRegex = "function foo() {var v = /\}\{/;}";
var js_multilineFunc = "function foo(a, b, c) {\nvar d =\n  5;\n}";
var js_multiStatements = "var a = 5;\nvar b = 9,\nc = /foo/;";

var JS_BREAKER_EXPECTATIONS = [
["@js{var a;}",
 ["var a;"]],
["@js{" + js_simpleFunc + "}",
 [js_simpleFunc]],
["@js{" + js_funcWithRegex + "}",
 [js_funcWithRegex]],
["@js{" + js_multilineFunc + "}",
 [js_multilineFunc]],
["@js{" + js_multiStatements + "}",
 [js_multiStatements]],
];

exports.testJsBreaking = function(test) {
  var ctx = new loader.ParserContext("test input");
  var reader_js = require("narscribblus/reader-js");
  ctx.readerMap["js"] = reader_js.reader_js;

  for (var i = 0; i < JS_BREAKER_EXPECTATIONS.length; i++) {
    var expectation = JS_BREAKER_EXPECTATIONS[i];
    var testString = expectation[0];
    var oExpect = {val: expectation[1]};
    var results = syn.textStreamAtBreaker(testString, ctx);
    results = results.map(function(rv) {
      if (typeof(rv) == "object" &&
          ("length" in rv) && rv[2] instanceof reader_js.JSBlock)
        return rv[2].text;
      return rv;
    });
    var oResult = {val: results};
    test.assertEqual(JSON.stringify(oExpect), JSON.stringify(oResult),
                     "Test string: '" + testString + "' failure.");
  }
};
