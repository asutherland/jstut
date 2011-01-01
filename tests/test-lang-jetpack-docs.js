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

require.def("narscribblus-tests/test-lang-jetpack-docs",
  [
    "narscribblus/langs/jetpack-docs",
    "exports"
  ],
  function(
    jd,
    exports
  ) {


var BLOCK_PARSE_EXPECTATIONS = [
  {
    name: "blah",
    lines: [
      "@function",
      "@param a",
      "@returns {number} dance!",
      "  dance dance!",
    ],
    typedump: {
      name: "blah",
      kind: "function",
      args: [
        {
          name: "a",
          type: "Object",
          optional: false,
          doc: null,
        },
      ],
      ret: {
        type: "Number",
        doc: "dance!\ndance dance!",
      },
    }
  },
  {
    name: "Foo",
    lines: [
      "@constructor",
      "text 1.",
      "text 2.",
      "@param arr {array}",
      "  arr d arr arr.",
      "@param def {object}",
      "  @prop a {number}",
      "  I describe a.",
      "  @prop b {object} I describe b",
      "  somewhat.",
      "    @prop b1 {number}",
      "        b1 is nested, you see.",
      "      and has nesting.",
      "  @prop [c] {object}",
      "  optional c fellow.",
      "    with some indentation.",
      "  @prop [d=5] {number} I have a default.",
      "@param bob {number,string}",
      "@param [cat='dog'] {String}",
    ],
    typedump: {
      name: "Foo",
      kind: "class",
      constructor: {
        name: "Foo",
        kind: "constructor",
        text: "text1.\ntext2.",
        args: [
          {
            name: "arr",
            type: "Array",
            optional: false,
            doc: "arr d arr arr.",
          },
          {
            name: "def",
            optional: false,
            type: {
              kind: "dict",
              doc: null,
              children: {
                a: {
                  type: "Number",
                  optional: false,
                  doc: "I describe a.",
                },
                b: {
                  doc: "I describe b\nsomewhat.",
                  optional: false,
                  type: {
                    kind: "dict",
                    children: {
                      b1: {
                        type: "Number",
                        doc: "  b1 is nested, you see.\nand has nesting.",
                      },
                    }
                  }
                },
                c: {
                  type: "Object",
                  optional: true,
                  doc: "optional c fellow.\n  with some indentation.",
                },
                d: {
                  type: "Number",
                  optional: true,
                  "default": 5,
                  doc: "I have a default.",
                },
              },
            },
          },
          {
            name: bob,
            optional: false,
            type: {
              kind: "oneof",
              types: [
                "Number",
                "String",
              ],
            }
          },
          {
            name: cat,
            optional: true,
            default: "dog",
            type: "String",
          },
        ],
      }
    },
  },
  {
    name: "methy",
    lines: [
      "@method",
      "method desc.",
      "@returns {object}",
      "  the returninator.",
      "  @prop foo {number}",
      "    foo desc.",
    ],
    // we want to null out the constructor of the type dump so we don't need to
    //  re-check it.
    clobberInTypeDump: [
      ["constructor"],
    ],
    typedump: {
      name: "Foo",
      kind: "class",
      constructor: null,
      prototype: {
        kind: "object",
        methy: {
          kind: "method",
          doc: "method desc.",
          args: [
          ],
          ret: {
            kind: "dict",
            doc: "the returninator.",
            children: {
              foo: {
                type: "Number",
                doc: "foo desc.",
              }
            }
          }
        },
      },
    },
  },
  {
    name: "propy",
    lines: [
    ],
    clobberInTypeDump: [
      ["constructor"],
      ["instance", "methy"],
    ],
    typedump: {
      name: "Foo",
      kind: "class",
      constructor: null,
      instance: {
        methy: null,
        propy: {
        }
      }
    }
  },
];

exports.testBlockParser = function(test) {
  // this is a stateful test!
  for (var i = 0; i < BLOCK_PARSE_EXPECTATIONS.length; i++) {
    var expecty = BLOCK_PARSE_EXPECTATIONS[i];
    var typish = jd.parseJetpackAPIBlock(expecty.name, expecty.lines);
    test.assertEqual(JSON.stringify(typish), JSON.stringify(expecty.typedump));
  }
};

}); // end require.def
