# Service for the retrieval of Translations from BlueSky

@App.service 'MnoeBlueSky', (MnoeApiSvc) ->
  _self = @

  @getSchemaTranslation = ->
    MnoeApiSvc.one("/schema_translations").get({locale: 'en-us'})
  return @
