var syn = require("narscribblus/scribble-syntax");
var reader_js = require("narscribblus/reader-js");

exports.parse = function parse(s, ctx) {
  return syn.textStreamAtBreaker(s, ctx);
};

exports.narscribblusReaderFuncs = {
  js: reader_js.reader_js,
};
