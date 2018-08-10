# Service for the retrieval of Translations from BlueSky

angular.module 'mnoEnterpriseAngular'
  .service 'MnoeBlueSky', (MnoeApiSvc) ->
    _self = @

    bs_editor = {}
    translations = {}

    @getSchemaTranslation = ->
      MnoeApiSvc.one("/schema_translations").get()

    @setBSEditor = (editor) ->
      bs_editor = editor

    @getCachedBSEditor = ->
      bs_editor

    @setSchemaTranslations = (t) ->
      translations = t

    @getCachedTranslations = ->
      translations

    return @
