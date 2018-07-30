# Service for the retrieval of Translations from BlueSky

@App.service 'MnoeBlueSky', (MnoeApiSvc) ->
  _self = @

  bs_editor = {}
  translations = {}

  @getSchemaTranslation = ->
    MnoeApiSvc.one("/schema_translations").get({locale: 'en-us'})

  @setBSEditor = (editor) ->
    bs_editor = editor

  @getCachedBSEditor = ->
    bs_editor

  @setSchemaTranslations = (t) ->
    translations = t

  @getCachedTranslations = ->
    translations

  return @
