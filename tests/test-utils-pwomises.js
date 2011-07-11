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

define("jstut-tests/test-utils-pwomises",
  [
    "jstut/utils/pwomise",
    "exports"
  ],
  function(
    pwomise,
    exports
  ) {

var when = pwomise.when, defer = pwomise.defer, forward = pwomise.forward,
    enqueue = pwomise.enqueue;

/**
 * Build a tree representation of the promises.
 *
 * @typedef[PromiseTreeNode @dict[
 *   @key[name String]{
 *     What was promised.
 *   }
 *   @key[kids @listof[PromiseTreeNode]]
 * ]]
 *
 * @return[PromiseTreeNode]
 */
function treeifyPromise(p) {
  // build the node that describes us
  var self;
  if ("promiseDeps" in p) {
    self = {name: p.what, kids: []};
    for (var i = 0; i < p.promiseDeps.length; i++) {
      // ignore bounce for now...
      if (p.promiseDeps[i] === "bounce")
        continue;
      var kid = treeifyPromise(p.promiseDeps[i]);
      if (kid.length == 1)
        kid = kid[0];
      self.kids.push(kid);
    }
  }
  else {
    self = p.what;
  }

  return self;
}

exports.testCakeSimple = function(test) {
  test.waitUntilDone();

  function getIngredients(fresh) {
    if (!fresh) {
      // send our primary butler to the store
      var ingredients = defer("ingredients");
      enqueue(function() { ingredients.resolve(["milk", "eggs"]); });
      return ingredients.promise;
    }

    // send our primary butler to the dairy
    var milk = defer("milk");
    enqueue(function() { milk.resolve("milk"); });

    // send our secondary butler to the eggery
    var eggs = defer("eggs");
    enqueue(function() { eggs.resolve("eggs"); });

    return pwomise.all([milk.promise, eggs.promise], null, "ingredients");
  }

  function mix(ingredients) {
    // we use a mixing machine to do most of the work; it's async...
    var mixing = defer("mix");
    enqueue(function() { mixing.resolve("batter"); });
    return mixing.promise;
  }

  function bake(batter) {
    var baked = defer("bake");
    enqueue(function() { baked.resolve("fully baked cake"); });
    return baked.promise;
  }

  function ice() {
    return "iced cake";
  }

  function makeCake(freshIngredients) {
    // should backlink to ingredients
    var mixed = when(getIngredients(freshIngredients), mix);
    // should backlink to mixed
    var baked = when(mixed, bake);
    // should backlink to baked
    var iced = when(baked, ice);

    return pwomise.wrap(iced, "cake");
  }

  var cakeDone = makeCake(true);
  when(cakeDone, function() {
    var ptree = treeifyPromise(cakeDone);
    var expectedTree = {"tree":
      {
        "name": "cake",
        "kids": [
          {
            name: "auto:ice",
            kids: [
              {
                name: "auto:bake",
                kids: [
                  {
                    name: "auto:mix",
                    kids: [
                      {
                        "name": "ingredients",
                        "kids": [ // parallel run of...
                          "milk",
                          "eggs"
                        ]
                      },
                      "mix",
                    ]
                  },
                  "bake",
                ]
              },
            ],
          },
        ]
      }
    };
    test.assertEqual(JSON.stringify({tree: ptree}),
                     JSON.stringify(expectedTree),
                     "resulting tree structure");
    test.done();
  });
};

}); // end define
