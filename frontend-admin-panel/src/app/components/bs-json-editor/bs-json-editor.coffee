@App.directive('blueSkyJsonEditor', ($locale) ->
  return {
    restrict: 'E'
    scope: {
      schema: '='
      initialValues: '='
      scrollable: '='
      heading: '@'
      callbackFunction: '='
      editor: '='
      schemaName: '='
      externalvalidationurl: '='
      validateConfiguration: '@'
      textNoResults: '@'
      enableWrapping: '@'
    }
    templateUrl: 'app/components/bs-json-editor/bs-json-editor.html',
    link: (scope, element, attrs) ->
      datepickerFixes = -> { 'in': 'id' }

      defaultWrapLevel = if attrs.enableWrapping then '3': '33%' else null

      lang = ((myLocale) ->
        # sometime we use the locale, but with some locales the jquery plugin need another definition (check https://github.com/jquery/jquery-ui/tree/master/ui/i18n )
        localeToReturn = myLocale or 'en'
        if datepickerFixes[myLocale]
          localeToReturn = datepickerFixes[myLocale]
        localeToReturn
      )($locale.locate)

      options =
        schemaName: scope.schemaName or attrs.schemaName
        schema: scope.schema
        initialValues: scope.initialValues
        scrollable: scope.scrollable
        heading: scope.heading
        $locale: $locale
        externalvalidationurl: scope.externalvalidationurl # decide the flow for external validations OPAL-480
        translations:
          errorTranslations: scope.errorTranslations || errorTranslations
          productSchemaTranlations: scope.productTranslations || productTranslations
        language: lang
        wrapLevel: scope.schema?.wrapLevel or attrs?.wrapLevel or defaultWrapLevel
        textNoResults: attrs.textNoResults

      domEditor = new DomWorker(element, options)

      fireCallBack = ->
        that = this

        executeCallback = ->
          if scope.callbackFunction and typeof scope.callbackFunction == 'function'
            scope.callbackFunction that.errors.length, that.editor.getValue()

        if scope.$root.$$phase
          executeCallback()
        else
          scope.$apply ->
            executeCallback()

      domEditor.$on 'change', ->
        fireCallBack.call this

      domEditor.$on 'error', ->
        fireCallBack.call this

      domEditor.$on 'load', ->
        scope.editor = @editor
        scope.isLoadingHTML = false
        fireCallBack.call this
  }
)
