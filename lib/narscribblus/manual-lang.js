var syn = require("narscribblus/scribble-syntax");

exports.parse = function parse(s, ctx) {
  return syn.textStreamAtBreaker(s, ctx);
};

exports.narscribblusReaderFuncs = {
};
