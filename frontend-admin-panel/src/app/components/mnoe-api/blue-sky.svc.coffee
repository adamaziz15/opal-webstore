@App.service 'MnoeBlueSky', (MnoeApiSvc, $locale, $q, $http) ->
  _self = @

  bs_editor = {}
  translationsDeferred = null
  configPromise = null

  @fetchBlueSkyConfig = ->
    unless configPromise
      configPromise = MnoeApiSvc.one("/bluesky_config").get().then(
        (response) ->
          response.data
      )

    configPromise

  @getSchemaTranslations = ->
    return translationsDeferred.promise if translationsDeferred

    translationsDeferred = $q.defer()

    _self.fetchBlueSkyConfig().then(
      (config) ->
        DomWorker.$Translations.$init({
          'baseUrl': config.bluesky_host + '/language',
          'fallback-lang': 'en-us',
          'preferred-lang': $locale.id
        })

        # Fetch portal locales (to translate disclaimers)
        url = '/language/:locale/portal_:locale.json'
        fallback = $http.get(config.bluesky_host + url.replace(/:locale/g, 'en-us'))
        preferred = $http.get(config.bluesky_host + url.replace(/:locale/g, $locale.id))
        $q.all({ fallback: fallback, preferred: preferred }).then(
          (portalTranslations) ->
            # The translationsDeferred promise should not be resolved until all translations are set
            # on the DomWorker. This prevents loading of the editor before translations are present.
            onEditorTranslationsLoaded = (iterations = 0) ->
              iterations += 1
              editorTranslations = DomWorker.$Translations
              if (editorTranslations.errorTranslations && editorTranslations.productTranslations) || iterations == 60
                translationsDeferred.resolve({
                  errorTranslations: editorTranslations.errorTranslations,
                  productTranslations: editorTranslations.productTranslations,
                  portalTranslations: angular.merge(portalTranslations.fallback.data, portalTranslations.preferred.data)
                })
              else
                # If translations are not set on the DomWorker yet, check again in 250ms.
                # Continue checking for 60 iterations (15 seconds). If translations are
                # not set after 15 seconds, resolve the translationsDeferred promise
                # to avoid infinite loading.
                setTimeout(onEditorTranslationsLoaded.bind(null, iterations), 250)

            onEditorTranslationsLoaded()
        )
    )

    translationsDeferred.promise

  @setBSEditor = (editor) ->
    bs_editor = editor

  @getCachedBSEditor = ->
    bs_editor

  @parseJsonEditorValues = (values, toLocalFormat = false) ->
    datepickerFormat = (moment().toMomentFormatString($locale.DATETIME_FORMATS.shortDate)).replace('YY', 'YYYY') || 'MM/DD/YYYY'
    parseValues = (key, value) ->
      if !angular.isString(key)
        return value

      if key.toLowerCase() == 'billingstartdate' && !value
        value = moment().utcOffset('+0000').format(datepickerFormat)

      if (key.toLowerCase() == 'startdate' || key.toLowerCase() == 'enddate' || key.toLowerCase() == 'billingstartdate') && value && $locale.DATETIME_FORMATS
        if value.toLowerCase() == 'open'
          return value

        if toLocalFormat
          return moment.utc(value, 'YYYY-MM-DDT00:00:00ZZ').local().format(datepickerFormat)
        else
          return moment.utc(value, datepickerFormat).format('YYYY-MM-DDT00:00:00ZZ')

      value

    getNextValue = (item) ->
      if angular.isArray(item)
        _.each(item, (subItem) ->
          _.each(subItem, (subValue, subKey) ->
            subItem[subKey] = parseValues(subKey, subItem[subKey])
            return
          )
        )
      else
        _.each(item, (subValue, subKey) ->
          if angular.isObject(subValue)
            getNextValue(subValue)
          else
            item[subKey] = parseValues(subKey, item[subKey])
          return
        )

    _.each(values, (value, key) ->
      if angular.isObject(value)
        getNextValue(value)
      else
        values[key] = parseValues(key, values[key])
      return
    )

    values

  return @
