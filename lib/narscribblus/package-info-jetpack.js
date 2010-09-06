/**
 * Jetpack packaging information is stored in the 'packaging' info global.
 *  Both source and data is accessed via resource:// protocol paths which
 *  can be converted back into filesystem references.  We do not assume
 *  anything clever about layout.
 *
 * All public documentation lives in package-info.js.
 **/

function loadSource(aSourceRef) {
  var loader = packaging.harnessService.loader;
  var path = loader.fs.resolveModule(null, moduleName);
  var o = loader.fs.getFile(path);

  return o.contents;
}
exports.loadSource = loadSource;

function loadData(aDataRef) {

}
exports.loadData = loadData;
