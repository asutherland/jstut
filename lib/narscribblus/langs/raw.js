/**
 * Just syntax highlight the raw document.  To make sure we get all the right
 *  readers we import the 'detected' lang type and steal its readers.  At some
 *  point we will also be able to provide information on what the various
 *  at-commands do by stealing its function map.  But not right now.
 **/

var syn = require("narscribblus/readers/scribble-syntax");

exports.parse = function parse(s, ctx) {
  ctx.rawMode = true;
  ctx.curTokenRun = [];
  ctx.tokenRuns = [ctx.curTokenRun];
  return syn.textStreamAtBreaker(s, ctx);
};

exports.expand = function expand(nodes, ctX) {

};

