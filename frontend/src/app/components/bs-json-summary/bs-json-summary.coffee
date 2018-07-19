angular.module 'mnoEnterpriseAngular'
  .directive('blueSkyJsonSummary', ->
    return {
      restrict: 'E'
      scope: {
        targetObject: '=',
        editor: '='
      }
      templateUrl: 'app/components/bs-json-summary/bs-json-summary.html',
      link: (scope, element, attrs) ->
        element[0].parentElement.parentElement.classList.add 'cube-loader'

        createWebWorkerDictionary = ->
          for key of scope.editor.Dictionary
            if key == 'root'
              continue
            value = scope.editor.Dictionary[key]
            if value
              key = key.substring(5)
              Dictionary[key] =
                title: value.title or value.key
                propertyOrder: value.propertyOrder
                hidden: isElementHidden(value)
                enum_display: value.enum_display or value.options and value.options.enum_titles
                enum_options: value.enum_values or value.enum
                hierarcy: key.split('.').length
                format: value.format

        isElementHidden = (value) ->
          if value.container
            isHidden = if value.container.style.display == 'none' then true else false
          else if value.display
            return if value.display == 'none' then true else false
          else
            isHidden = value.options and value.options.hidden or value.options and value.options.hide_display
          isHidden

        renderSummaryWorker = new Worker('webworker/renderSummary.webWoker.js')
        Dictionary = {}

        createWebWorkerDictionary()

        postMessageData = [
          scope.targetObject
          Dictionary
        ]
        renderSummaryWorker.postMessage postMessageData

        renderSummaryWorker.onmessage = (e) ->
          element[0].querySelector('#editorjsonform').innerHTML = e.data
          renderSummaryWorker.terminate()
          element[0].parentElement.parentElement.classList.remove 'cube-loader'
    }
)
