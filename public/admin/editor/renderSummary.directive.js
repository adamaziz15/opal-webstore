(function() {

  angular.module('wrcApp')
    .directive('renderSummary', ['bs_jsoneditorlang', '$locale', function(bs_jsoneditorlang, $locale) {
      return {
        templateUrl: 'webworker/renderSummary.view.html',
        restrict: 'E',
        scope: {
          targetObject: '=',
          editor: '='
        },
        link: function(scope, element, attrs) {
          element[0].parentElement.parentElement.classList.add("cube-loader");
          var renderSummaryWorker = new Worker('webworker/renderSummary.webWoker.js');

          var Dictionary = {};

          function createWebWorkerDictionary() {

            for (var key in scope.editor.Dictionary) {
              if (key === "root")
                continue;

              var value = scope.editor.Dictionary[key];
              if (value) {
                key = key.substring(5);

                Dictionary[key] = {
                  title: (value.title || value.key),
                  propertyOrder: value.propertyOrder,
                  hidden: isElementHidden(value),
                  enum_display: value.enum_display || value.options && value.options.enum_titles,
                  enum_options: value.enum_values || value.enum,
                  hierarcy: key.split(".").length,
                  format: value.format
                }
              }
            }
          }


          function isElementHidden(value) {

            var isHidden;
            if (value.container) {
              isHidden = value.container.style.display === "none" ? true : false;
            } else if (value.display) {
              return value.display === "none" ? true : false;
            } else {
              isHidden = value.options && value.options.hidden || value.options && value.options.hide_display;
            }

            return isHidden;

          }

          createWebWorkerDictionary();

          var postMessageData = [
            scope.targetObject,
            Dictionary
          ];

          renderSummaryWorker.postMessage(postMessageData);

          renderSummaryWorker.onmessage = function(e) {
            element[0].querySelector("#editorjsonform").innerHTML = e.data;
            renderSummaryWorker.terminate();
            element[0].parentElement.parentElement.classList.remove("cube-loader")
          }
        }
      };
    }]);

})();
