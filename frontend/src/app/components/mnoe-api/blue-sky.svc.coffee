# Service for the retrieval of Translations from BlueSky

angular.module 'mnoEnterpriseAngular'
  .service 'MnoeBlueSky', (MnoeApiSvc) ->
    _self = @

    @getSchemaTranslation = (locale) ->
      MnoeApiSvc.one("/schema_translations").get({locale: locale})

    return @
