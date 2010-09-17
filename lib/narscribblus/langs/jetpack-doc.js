/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Messaging Code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

require.def("foo", ["exports", "bar", "baz"], function(exports, bar, baz) {





});


/**
 * Jetpack documentation is markdown syntax with <api></api> blocks distributed
 *  throughout.  Each api tag has a name attribute.  The bad news is that the
 *  name does not have an explicit context.  The good news is that we can
 *  (hopefully) reliably infer that property/method definitions after a
 *  constructor belong to that class.
 *
 * Inside the api block are at-prefixed directives with pythonic/scribble
 *  whitespace semantics.  The first at-directive indicates the type of the name
 *  being described and its payload is a description of the type/whatever.  It
 *  is potentially followed by parameter definitions and a return value
 *  definition.  Hierarchy can be established using whitespace nesting.
 *
 * Supported types/initial at-directives and our mappings are:
 * @itemize[
 *   @item{
 *     constructor: Maps to a class.  All public Jetpack APIs do not require
 *     new to be used and will self-new, which is something to make sure the
 *     semantic logic understands.
 *   }
 *   @item{
 *     method: A method on a class.  Implicitly assigned to the last class
 *     defined by a constructor.
 *   }
 *   @item{
 *     property: A property on a class.  Implicitly assigned to the last class
 *     defined by a constructor.
 *   }
 *   @item{
 *     function: A standalone function.
 *   }
 * ]
 *
 * The jetpack doc parser just splits things into markdown or API blocks.
 *  Because we want to do our magic syntax highlighting on example code we
 *  scan through what otherwise belongs to markdown to find code blocks.  We
 *  claim them for ourselves.  Since code blocks need to be indented 4 spaces,
 *  this bit is pretty easy.
 **/

require.def("narscribblus/langs/jetpack-doc",
  [
    "exports",
  ],
  function(
    exports
  ) {


    



});

