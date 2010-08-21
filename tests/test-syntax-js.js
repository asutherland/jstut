var syn = require("narscribblus/readers/scribble-syntax");
var loader = require("narscribblus/scribble-loader");

var js_simpleFunc = "function foo() {}";
var js_funcWithRegex = "function foo() {var v = /\}\{/;}";
var js_multilineFunc = "function foo(a, b, c) {\nvar d =\n  5;\n}";
var js_multiStatements = "var a = 5;\nvar b = 9,\nc = /foo/;";

var JS_BREAKER_EXPECTATIONS = [
// -- straightforward breaking
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
// -- whitespace normalization
// - basic normalization
// (lose the intro line and trailing newline)
["@js{\n" +
 "  var a = 5;\n" +
 "  var b = 6;\n" +
 "}",
 ["var a = 5;\n" +
  "var b = 6;"]],
// - leftmost column becomes zero column
["@js{\n" +
 "  var a = 5;\n" +
 "    var b = 6;\n}",
 ["var a = 5;\n" +
  "  var b = 6;"]],
["@js{\n" +
 "    var a = 5;\n" +
 "  var b = 6;\n}",
 ["  var a = 5;\n" +
  "var b = 6;"]],
// (pretend the whole js construct is indented
["@js{\n" +
 "    var a = 5;\n" +
 "      var b = 6;\n  }",
 ["var a = 5;\n" +
  "  var b = 6;"]],
];

exports.testJsBreaking = function(test) {
  var ctx = new loader.ParserContext("test input");
  var reader_js = require("narscribblus/readers/js");
  ctx.readerMap["js"] = reader_js.reader_js;

  for (var i = 0; i < JS_BREAKER_EXPECTATIONS.length; i++) {
    var expectation = JS_BREAKER_EXPECTATIONS[i];
    var testString = expectation[0];
    var oExpect = {val: expectation[1]};
    var results = syn.textStreamAtBreaker(testString, ctx);
    results = results.map(function(rv) {
      if (typeof(rv) == "string")
        return rv;
      if (rv instanceof reader_js.JSBlock)
        return rv.flattenTokenStream();
      return [rv.name, rv.svals, rv.textStream];
    });
    var oResult = {val: results};
    test.assertEqual(JSON.stringify(oExpect), JSON.stringify(oResult),
                     "Test string: '" + testString + "' failure.");
  }
};
