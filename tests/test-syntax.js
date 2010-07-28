/**
 * Test scribble syntax parsing fundamentals.
 **/

var syn = require("narscribblus/scribble-syntax");
var loader = require("narscribblus/scribble-loader");

var ALT_SYNTAX_MIRROR_EXPECTATIONS = [
  ["|{", "}|"],
  ["|<<<{", "}>>>|"],
  ["|({", "})|"],
  ["|[[{", "}]]|"],
  ["|<>({", "})<>|"],
];

exports.altSyntaxMirror = function(test) {
  for (var i = 0; i < ALT_SYNTAX_MIRROR_EXPECTATIONS.length; i++) {
    var s = ALT_SYNTAX_MIRROR_EXPECTATIONS[i];
    test.assertEqual(s[1], syn.altSyntaxMirror(s[0]), "mirroring " + s[0]);
  }
};

// These tests assumed @;{ ;} is required, but that's not really the case.
//  Luckily it's not a big deal.
var NESTED_COMMENT_EXPECTATIONS = [
  ["@;{;}", 0, undefined],
  ["@;{foo;}", 0, undefined],
  ["  @;{foo;}  ", 2, -2],
  ["x@;{@;{;};}x", 1, -1],
  ["x@;{@;{@;{;}@;{;};};}x", 1, -1],
];

exports.nestedCommentWalker = function(test) {
  for (var i = 0; i < NESTED_COMMENT_EXPECTATIONS.length; i++) {
    var expected = NESTED_COMMENT_EXPECTATIONS[i];
    var expectedEndex = (expected[2] === undefined) ? expected[0].length
                          : expected[0].length + expected[2];
    var actualEndex = syn.nestedCommentWalker(expected[0], expected[1]);
    test.assertEqual(expectedEndex, actualEndex, "expected != actual");
  }
};

var SEXPR_EXPECTATIONS = [
  ["",
   []],
  ["0",
   [0]],
  [" 0 ",
   [0]],
  ["0 1 2",
   [0, 1, 2]],
  ['"foo"',
   ["foo"]],
  ['"foo" "bar"',
   ["foo", "bar"]],
  ['"foo bar"',
   ["foo bar"]],
  ["#t #f #t",
   [true, false, true]],
];

exports.sexprParser = function(test) {
  var ctx = new loader.ParserContext("test input");
  for (var i = 0; i < SEXPR_EXPECTATIONS.length; i++) {
    var expectation = SEXPR_EXPECTATIONS[i];
    var testString = expectation[0];
    var oExpect = {val: expectation[1]};
    var oResult = {val: syn.sexprParser(testString, ctx)[0]};
    test.assertEqual(JSON.stringify(oExpect), JSON.stringify(oResult),
                     "Test string: '" + testString + "' failure.");
  }
};


var AT_BREAKER_EXPECTATIONS = [
  // -- absolute basics
  ["foo",
   "foo"],
  ["@foo",
   [["foo", null, null]]],
  ['@["foo"]',
   [[null, ["foo"], null]]],
  ["@{foo}",
   [[null, null, "foo"]]],
  ["@foo[0]",
   [["foo", [0], null]]],
  ["@foo{baz}",
   [["foo", null, "baz"]]],
  ["@[5 5]{baz}",
   [[null, [5, 5], "baz"]]],
  ['@foo["bar"]{baz}',
   [["foo", ["bar"], "baz"]]],
  ["@foo[]{}",
   [["foo", [], ""]]],

  // -- basic sequence support
  ["foo @bar baz",
   ["foo ", ["bar", null, null], " baz"]],
  ["@foo bar @baz",
   [["foo", null, null], " bar ", ["baz", null, null]]],

  // -- body
  // whitespace is significant in bodies too
  ["@foo{ bar }",
   [["foo", null, " bar "]]],
  // balanced braces are cool
  ["@foo{{}}",
   [["foo", null, "{}"]]],
  ["@foo{{{}{}}{}}",
   [["foo", null, "{{}{}}{}"]]],

  // - escaped strings
  ['@"foo"',
   "foo"],
  // merge with adjacent string bits
  ['@"foo" @"bar"',
   "foo bar"],
  ['foo@"@"bar.com',
   "foo@bar.com"],
  // unaffected by other nesting logic.
  ['@foo{@"{" what what}',
   [["foo", null, "{ what what"]]],

  // - alternate syntax
  // things that would be illegal but for our guards
  ["@foo|{{{{}|",
   [["foo", null, "{{{"]]],
  // things that would normally match but for our guards
  ["@foo|<<{}>>|",
   [["foo", null, ""]]],
  ["@foo|<<{@bar @[baz]}>>|",
   [["foo", null, "@bar @[baz]"]]],
  // escaped things that do match
  ["@foo|<<{|<<@bar |<<@[#t]}>>|",
   [["foo", null, [
       ["bar", null, null],
       " ",
       [null, [true], null]]]]],

  // -- expression escape
  ["@|foo|",
   [[null, "foo", null]]],
  ["@{foo @|bar|}",
   [[null, null, [
       "foo ",
       [null, "bar", null]]]]],
  ["@foo{bar@|baz|bog}",
   [["foo", null, [
       "bar",
       [null, "baz", null],
       "bog"]]]],

  // -- comments (without whitespace ramifications)
  // - block
  // simple
  ["foo @;{ blah } baz",
   "foo  baz"],
  // nested
  ["foo @;{ {blah} {} } baz",
   "foo  baz"],

  // - line
  ["foo @;\nbar",
   "foo bar"],
  ["foo @; blah blah blah\nbar",
   "foo bar"],

  // -- whitespace (includes comment tricks)
  // XXX these are not remotely the official semantics for whitespace; we
  //  will need to get to those, although that might happen as a subsequent
  //  pass.
  // - line comments eat whitespace after the newline.
  ["foo @;\n  \t bar",
   "foo bar"],

  // -- cody body complexity
  ["@foo[@{bar}   5\n  @{baz}]",
   [["foo", [
     [null, null, "bar"],
     5,
     [null, null, "baz"]], null]]],
];

exports.atBreaker = function(test) {
  var ctx = new loader.ParserContext("test input");
  for (var i = 0; i < AT_BREAKER_EXPECTATIONS.length; i++) {
    var expectation = AT_BREAKER_EXPECTATIONS[i];
    var testString = expectation[0];
    var oExpect = {val: expectation[1]};
    var results = syn.textStreamAtBreaker(testString, ctx);
    if (typeof(results) == "object") {
      function transformy(r) {
        if (typeof(r) !== "object" || r == null)
          return r;
        return r.map(function(rv) {
          if (typeof(rv) !== "object" || r == null)
            return rv;
          if (rv instanceof syn.AtCommand)
            return [rv.name, transformy(rv.svals), transformy(rv.textStream)];
          throw new Error("Unexpected result value type: " + rv +
                          " on " + testString);
        });
      }
      results = transformy(results);
    }
    var oResult = {val: results};
    test.assertEqual(JSON.stringify(oExpect), JSON.stringify(oResult),
                     "Test string: '" + testString + "' failure.");
  }
};
