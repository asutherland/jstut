/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Messaging Code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Test scribble syntax parsing fundamentals.
 **/

define("narscribblus-tests/test-syntax",
  [
    "narscribblus/readers/scribble-syntax",
    "narscribblus/doc-loader",
    "exports"
  ],
  function(
    syn,
    loader,
    exports
  ) {

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
  ["#:a #:foo #:bar",
   [new syn.Keyword("a"), new syn.Keyword("foo"), new syn.Keyword("bar")]],
  ["foo Bar",
   [new syn.Identifier("foo"), new syn.Identifier("Bar")]],
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
   [[null, [new syn.Identifier("foo")], null]]],
  ["@{foo @|bar|}",
   [[null, null, [
       "foo ",
       [null, [new syn.Identifier("bar")], null]]]]],
  ["@foo{bar@|baz|bog}",
   [["foo", null, [
       "bar",
       [null, [new syn.Identifier("baz")], null],
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
   [["foo",
     [
       [null, null, "bar"],
       5,
       [null, null, "baz"]
     ],
     null]]],
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
          if (rv instanceof syn.Identifier)
            return rv;
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

}); // end define
