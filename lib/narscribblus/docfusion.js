/**
 * @section{Overview}
 *
 * The aggregate documentation we want to present to the user is potentially
 *  comprised of multiple sources.  Namely:
 *
 * @itemize[
 *   @item{Documentation in the source code.  This can consist of overview
 *         descriptions or documentation explicitly associated with classes,
 *         functions, attributes, etc.  We would expect this to primarily
 *         end up as implementation documentation or API reference
 *         documentation.}
 *   @item{Documentation in dedicated documentation files.  This can consist
 *         of overview descriptions that would not make sense in a source
 *         file, tutorials, or user-focused reference documentation that would
 *         not benefit from being located in the implementing source files.}
 * ]
 *
 * Since these disparate sources need to be fused somewhere, they are fused
 *  here.  The doc fusion implementation is responsible understanding the
 *  sources and building a single resulting documentation representation.
 *
 *
 * @section{Namespaces, Dependencies, Completeness}
 *
 * Code exposure results in:
 * - modules
 * - synthetic top-level type namespace (categorized)
 *
 **/

/**
 * Represents / populates the documentation and possibly source for a given
 *  package.
 *
 * We have the following
 * 
 * For JS source modules we can provide the following information:
 *
 */
function PackageFusion() {

}
PackageFusion.prototype = {
  requireModule: function(name) {

  }
};

function ModuleInfo() {

}
ModuleInfo.prototype = {

};

exports.getDocsForPackage = function getDocsForPackage(packageName) {

};
