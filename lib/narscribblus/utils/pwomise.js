
/**
 * Lightly modified version of promise.js that adds support for debug meta-info
 *  generation.
 **/

// Debug meta-info changes by Andrew Sutherland <asutherland@asutherland.org>

// Tyler Close
// Ported by Kris Kowal
// Variation to illustrated ideas for improvements on the API.
// * Deferred, Rejection, Reference instead of defer, reject, ref, and promise.
// * Promise constructor that takes a descriptor and fallback.
// * near has been changed to valueOf, and uses a valueOf operator instead
//   an undefined operator, to reduce special cases.
// * variadic arguments are used internally where applicable (POST arguments
//   have not yet been altered.

/*
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 *
 * ref_send.js version: 2009-05-11
 */

/*whatsupdoc*/

// - the enclosure ensures that this module will function properly both as a
// CommonJS module and as a script in the browser.  In CommonJS, this module
// exports the "Q" API.  In the browser, this script creates a "Q" object in
// global scope.
// - the use of "undefined" on the enclosure is a micro-optmization for
// compression systems, permitting every occurrence of the "undefined" keyword
// bo be replaced with a single-character.

require.def("narscribblus/utils/pwomise",
  [
    "exports",
    "narscribblus-plat/event-loop",
  ],
  function (
    exports,
    eventloop
  ) {

var enqueue = eventloop.enqueue;

/**
 * @typedef[EmitFunc @func[
 *   @args[
 *     @param["op"]
 *     @rest["arguments"]
 *   ]
 * ]]{
 *   A synchronous function call to invoke a method on the promise/object when
 *   it is resolved.  For deferred promises, the invocation is always forwarded
 *   to a future cycle of the event loop to ensure consistent/sane ordering and
 *   avoid triggering user logic callbacks when still in the process of
 *   registering them.  For wrapped/immediate promises, the operation on the
 *   descriptor is invoked directly; if a resolve function is supplied, it is
 *   invoked, which is in turn expected to forward all of its invocations to
 *   future event loop cycles.
 * }
 *
 **/

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
exports.enqueue = enqueue;

/**
 * Constructs a {promise, resolve} object.
 *
 * The resolver is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke the resolver with any value that is
 * not a function. To reject the promise, invoke the resolver with a rejection
 * object. To put the promise in the same state as another promise, invoke the
 * resolver with that other promise.
 */
exports.defer = defer;

function defer(what, whatSpecifically) {
    // if "pending" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the pending array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the ref promise because it handles both fully
    // resolved values and other promises gracefully.
    var pending = [], value;

    var promise = Object.create(Promise.prototype);
    promise.emit = function () {
        var args = Array.prototype.slice.call(arguments);
        if (pending) {
            pending.push(args);
        } else {
            forward.apply(undefined, [value].concat(args));
        }
    };
    promise.what = what;
    promise.whatSpecifically = whatSpecifically;

    var resolve = function (resolvedValue) {
        var i, ii, task;
        if (!pending)
            return;
        value = ref(resolvedValue, "resolve:" + what);
        // re-target all the emit requests we received previously to the new
        //  value we received.
        for (i = 0, ii = pending.length; i < ii; ++i) {
            forward.apply(undefined, [value].concat(pending[i]));
        }
        pending = undefined;
    };

    return {
        "promise": promise,
        "resolve": resolve,
        "reject": function (reason) {
            resolve(reject(reason));
        }
    };
}

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * put(name, value), post(name, args), delete(name), and valueOf(), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
exports.Promise = Promise;

function Promise(descriptor, fallback) {

    if (fallback === undefined) {
        fallback = function (op) {
            return reject("Promise does not support operation: " + op);
        };
    }

    var promise = Object.create(Promise.prototype);

    promise.emit = function (op, resolved /* ...args */) {
        var args = Array.prototype.slice.call(arguments, 2);
        var result;
        if (descriptor[op])
            result = descriptor[op].apply(descriptor, args);
        else
            result = fallback.apply(descriptor, arguments);
        if (resolved)
            return resolved(result);
        return result;
    };
    promise.what = undefined;;
    promise.whatSpecifically = undefined;

    return promise;
};

Promise.prototype.toSource = function () {
    return this.toString();
};

Promise.prototype.toString = function () {
    return '[object Promise]';
};

Promise.prototype.valueOf = function () {
    return this.emit("valueOf");
};

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a resolved value.
 */
exports.isPromise = isPromise;
function isPromise(object) {
    return object instanceof Promise;
};

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
exports.reject = reject;

function reject(reason) {
    var promise = Promise({
        "when": function (rejected) {
            return rejected ? rejected(reason) : reject(reason);
        }
    }, function fallback(op, resolved) {
        var rejection = reject(reason);
        return resolved ? resolved(rejection) : rejection;
    });
    promise.what = "rejection";
    return promise;
}

/**
 * Constructs a promise for an immediate reference.
 * @param value immediate reference
 */
exports.ref = ref;

function ref(object, why) {
    // If the object is already a Promise, return it directly.  This enables
    // the ref function to both be used to created references from
    // objects, but to tolerably coerce non-promises to refs if they are
    // not already Promises.
    if (isPromise(object))
        return object;

    var wrapped = Promise({
        "when": function (rejected) {
            return object;
        },
        "get": function (name) {
            return object[name];
        },
        "put": function (name, value) {
            object[name] = value;
        },
        "delete": function (name) {
            delete object[name];
        },
        "post": function (name, args) {
            return object[name].apply(object, args);
        },
        "valueOf": function () {
            return object;
        }
    });
    wrapped.what = "wrapped:" + why;
    return wrapped;
}

/**
 * Constructs a promise method that can be used to safely observe resolution of
 * a promise for an arbitrarily named method like "propfind" in a future turn.
 *
 * "Method" constructs methods like "get(promise, name)" and "put(promise)".
 */
exports.Method = Method;
function Method (methodName) {
    return function (object) {
        var deferred = defer();
        var args = Array.prototype.slice.call(arguments, 1);
        forward.apply(undefined, [
            ref(object, "method"),
            methodName,
            deferred.resolve
        ].concat(args));
        return deferred.promise;
    };
}

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that resolved and rejected will be called only once.
 * 2. that either the resolved callback or the rejected callback will be
 *    called, but not both.
 * 3. that resolved and rejected will not be called in this turn.
 *
 * @param value     promise or immediate reference to observe
 * @param resolve function to be called with the resolved value
 * @param rejected  function to be called with the rejection reason
 * @return promise for the return value from the invoked callback
 */
exports.when = function (value, resolved, rejected) {
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    // Wrap the value in a promise if it is not already a promise.
    var promisedValue = ref(value, "when");
    var deferred = defer(
      (resolved && typeof(resolved) === "function" && resolved.name) ?
        ("auto:" + resolved.name) : undefined);
    deferred.promise.prevPromise = promisedValue;

    // Invoke "when" on promisedValue (in a subsequent cycle).  The magic reason
    // for doing this is that:
    //
    // - If promisedValue is a deferred promise, then it will hold these
    //  arguments in suspended animation until the promise completes.  When the
    //  promise is resolved, we are provided a value, and our arguments below
    //  will be targeted to the provided value.  If that value is itself a
    //  promise, the cycle continues until a wrapped value promise is
    //  encountered.
    //
    // - If promisedValue is a wrapped value promise, then its emit method
    //  will be invoked synchronously.  For the 'when' case, this will result
    //  in it simply returning the raw underlying value.  The emit function
    //  will then invoke the 'resolved' function we are passing in...
    forward(promisedValue, "when", function (value) {
        // (we are here inside our resolved function because the promisedValue
        //  eventually bottomed out in a wrapped value, and that (raw) value is
        //  being passed to us now.)
        if (done)
            return;
        done = true;

        // You will note that at this point we have not yet called the resolved
        //  function that the original caller to "when" passed in.  We do that
        //  now...
        // The wrapping of the value is somewhat gratuitous for the current
        //  implementation of this module.  Ignoring future fancy pants code,
        //  it amounts to calling the resolved handler.
        var retVal = ref(value).emit("when", resolved, rejected);
        if (isPromise(retVal))
          deferred.promise.betterPromise = retVal;
        var retPromise = ref(retVal, "retval");
        retPromise.prevPromise = deferred.promise.prevPromise;
        // We then pass the return value of the resolved method to our our
        //  resolve method (will will in turn "ref" it).
        deferred.resolve(retVal);
    }, function (reason) {
        if (done)
            return;
        done = true;
        deferred.resolve(rejected ? rejected(reason) : reject(reason));
    });
    return deferred.promise;
};

/**
 */
exports.asap = function (value, resolved, rejected) {
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks
    ref(value, "asap").emit("when", function (value) {
        if (done)
            return;
        done = true;
        deferred.resolve(
          ref(value, "asap-when").emit("when", resolved, rejected));
    }, function (reason) {
        if (done)
            return;
        done = true;
        deferred.resolve(rejected ? rejected(reason) : reject(reason));
    });
    return deferred.promise;
};

/**
 * Wrap an existing promise in a new promise exclusively for the debugging
 *  benefits; there are no functional benefits from this.
 */
exports.wrap = function (promise, what, whatSpecifically) {
  var deferred = defer(what, whatSpecifically);
  deferred.promise.subPromised = [promise];
  // we could probably optimize the extra enqueue-ings out of existence...
  exports.when(promise, deferred.resolve);
  return deferred.promise;
};

/**
 * Create a new promise that is resolved when all of the promises in the list of
 *  provided promises are resolved.  Most notably exposes debugging information
 *  that tracks all of the promises as parallel operations.
 */
exports.all = function (promises, what, whatSpecifically) {
  var deferred = exports.defer(what, whatSpecifically);
  var expectedCount = 0, triggeredCount = 0;
  function subPromiseFulfilled() {
    triggeredCount++;
    if (triggeredCount === expectedCount) {
      deferred.resolve();
    }
  }
  for (var i = 0; i < promises.length; i++) {
    expectedCount++;
    exports.when(promises[i], subPromiseFulfilled);
    deferred.promise.subPromised = promises.concat();
  }
  return deferred.promise;
};

/**
 * Like "all", but allows promises to be added dynamically until the group is
 *  locked.
 */
exports.joinableGroup = function (what, whatSpecifically) {
  var deferred = exports.defer(what, whatSpecifically);
  var expectedCount = 0, triggeredCount = 0;
  var locked = false;
  function subPromiseFulfilled() {
    triggeredCount++;
    if (triggeredCount === expectedCount) {
      // once we fire we are locked...
      locked = true;
      deferred.resolve();
    }
  }
  deferred.promise.subPromised = [];
  return {
    join: function(promise) {
      if (locked)
        throw new Error("no adding promises to a locked group");
      if (isPromise(promise)) {
        expectedCount++;
        exports.when(promise, subPromiseFulfilled);
        deferred.promise.subPromised.push(promise);
      }
    },
    promise: deferred.promise,
    lock: function() {
      if (!locked && expectedCount === 0)
        deferred.resolve();
      locked = true;
    },
    lockIfEmpty: function() {
      if (expectedCount === 0)
        this.lock();
    }
  };
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
exports.get = Method("get");

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
exports.put = Method("put");

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
exports.del = Method("del");

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param argv      array of invocation arguments
 * @return promise for the return value
 */
exports.post = Method("post");

/**
 * Guarantees that the give promise resolves to a defined, non-null value.
 */
exports.defined = function (value) {
    return exports.when(value, function (value) {
        if (value === undefined || value === null)
            return reject("Resolved undefined value: " + value);
        return value;
    });
};

/*
 * Enqueues a promise operation for a future turn.
 *
 * Eats the first argument, a promise, and enqueues the remaining arguments as
 *  arguments to a call to promise.emit on a subsequent turn.
 */
function forward(promise /*, op, resolved, ... */) {
    var args = Array.prototype.slice.call(arguments, 1);
    enqueue(function () {
        promise.emit.apply(promise, args);
    });
}

}); // end require.def
