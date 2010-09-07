// teleport loader magic causes this to load package-info-teleport
var platImpl = require("narscribblus/package-info-jetpack");


/**
 * Load a source file using a require-style source reference.  Once the body
 *  is available, a callback is invoked with the source reference and the
 *  body.  The callback may be invoked before this call returns.
 */
exports.loadSource = platImpl.loadSource;

/**
 * Load a data file from the given package.
 */
exports.loadData = platImpl.loadData;

exports.dataDirUrl = platImpl.dataDirUrl;
