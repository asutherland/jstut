/**
 * A registry for our reader-macro-equivalents for scribble parsing.
 *  Specifically, everything that registers against us will be called in the
 *  process of parsing scribble-syntax during the parsing.  They will be
 *  handed a string and expected to consume as much of the string as they
 *  'should' and then return to us how much they ate plus whatever result
 *  they want put in the result tree.
 **/

var registry = {};

exports.registerReader = function registerReader(aName, aReaderFunc) {
  if (aName in registry)
    throw new Error("Attempt to add a reader that already exists: " + aName);
  registry[aName] = aReaderFunc;
};
