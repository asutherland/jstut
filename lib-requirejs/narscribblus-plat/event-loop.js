require.def("narscribblus-plat/event-loop",
  [
    "exports",
  ],
  function (
    exports
  ) {

exports.enqueue = function(task) {
  setTimeout(task, 0);
};

}); // end require.def
