# Service for the retrieval of Translations from BlueSky

angular.module 'mnoEnterpriseAngular'
  .service 'MnoeBlueSky', (MnoeApiSvc) ->
    _self = @

    @getSchemaTranslation = ->
      MnoeApiSvc.one("/schema_translations").get()

    return @
