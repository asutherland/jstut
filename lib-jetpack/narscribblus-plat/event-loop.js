/**
 * This will only ever be loaded under jetpack because pwomise.js will detect
 *  setTimeout when operating under teleport.
 **/

require.def("narscribblus-plat/event-loop",
  [
    "exports",
    "timer",
  ],
  function (
    exports,
    timer
  ) {

exports.enqueue = function(task) {
  timer.setTimeout(task, 0);
};

});
