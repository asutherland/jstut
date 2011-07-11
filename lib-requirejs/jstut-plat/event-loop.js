define("jstut-plat/event-loop",
  [
    "exports",
  ],
  function (
    exports
  ) {

exports.enqueue = function(task) {
  setTimeout(task, 0);
};

}); // end define
