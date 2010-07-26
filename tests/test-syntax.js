var syn = require("narscribblus/scribble-syntax");

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

var AT_BREAKER_EXPECTATIONS = [
  // absolute basics
  ["foo",
   "foo"],
  ["@foo",
   [["foo", null, null]]],
  ["@[foo]",
   [[null, "foo", null]]],
  ["@{foo}",
   [[null, null, "foo"]]],
  ["@foo[bar]",
   [["foo", "bar", null]]],
  ["@foo{baz}",
   [["foo", null, "baz"]]],
  ["@[bar]{baz}",
   [[null, "bar", "baz"]]],
  ["@foo[bar]{baz}",
   [["foo", "bar", "baz"]]],
  ["@foo[]{}",
   [["foo", "", ""]]],

  // basic sequence support
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
  // things that would normally match but for our guards
  ["@foo|<<{}>>|",
   [["foo", null, ""]]],
  ["@foo|<<{@bar @[baz]}>>|",
   [["foo", null, "@bar @[baz]"]]],
  // escaped things that do match
  ["@foo|<<{|<<@bar |<<@[baz]}>>|",
   [["foo", null, [
       ["bar", null, null],
       " ",
       [null, "baz", null]]]]],

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

  // -- comments

];

exports.atBreaker = function(test) {
  for (var i = 0; i < AT_BREAKER_EXPECTATIONS.length; i++) {
    var expectation = AT_BREAKER_EXPECTATIONS[i];
    var testString = expectation[0];
    var oExpect = {val: expectation[1]};
    var oResult = {val: syn.textStreamAtBreaker(testString)};
    test.assertEqual(JSON.stringify(oExpect), JSON.stringify(oResult),
                     "Test string: '" + testString + "' failure.");
  }
};
