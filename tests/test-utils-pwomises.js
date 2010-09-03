
var pwomise = require("narscribblus/utils/pwomise");
var when = pwomise.when, defer = pwomise.defer, forward = pwomise.forward,
    enqueue = pwomise.enqueue;

/**
 *
 */
function treeifyPromise(p, containingList) {
  if ("betterPromise" in p)
    p = p.betterPromise;

  // build the node that describes us
  var self;
  if ("subPromised" in p) {
    self = {name: p.what, kids: []};
    for (var i = 0; i < p.subPromised.length; i++) {
      var kid = treeifyPromise(p.subPromised[i]);
      if (kid.length == 1)
        kid = kid[0];
      self.kids.push(kid);
    }
  }
  else {
    self = p.what;
  }

  // if we are part of a chain, perform a tail recursive back traversal...
  if (!containingList)
    containingList = [self];
  else
    containingList.unshift(self);

  if ("prevPromise" in p)
    return treeifyPromise(p.prevPromise, containingList);
  return containingList;
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

    return pwomise.all([milk.promise, eggs.promise], "ingredients");
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
    var expectedTree = {"tree": [
      {
        "name": "cake",
        "kids": [ // parallel run of...
          [ // serial run...
            {
              "name": "ingredients",
              "kids": [ // parallel run of...
                "milk",
                "eggs"
              ]
            },
            "mix",
            "bake",
            "auto:ice"
          ]
        ]
      }
    ]};
    test.assertEqual(JSON.stringify({tree: ptree}),
                     JSON.stringify(expectedTree),
                     "resulting tree structure");
    test.done();
  });
};
