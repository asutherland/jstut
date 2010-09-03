/**
 * This will only ever be loaded under jetpack because pwomise.js will detect
 *  setTimeout when operating under teleport.
 **/

var timer = require("timer");

exports.enqueue = function(task) {
  timer.setTimeout(task, 0);
};
