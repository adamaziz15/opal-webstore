@App.service 'MnoeBlueSky', (MnoeApiSvc, $locale, $q, $rootScope) ->
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

    if translationsLoaded()
      translationsDeferred.resolve({
        productTranslations: DomWorker.$Translations.productTranslations,
        errorTranslations: DomWorker.$Translations.errorTranslations
      })
    else
      _self.fetchBlueSkyConfig().then(
        (config) ->
          DomWorker.$Translations.$init({
            'baseUrl': config.bluesky_host + '/language',
            'fallback-lang': 'en-us',
            'preferred-lang': $locale.id
          })
      )

    translationsDeferred.promise

  translationsLoaded = ->
    DomWorker.$Translations.productTranslations && DomWorker.$Translations.errorTranslations

  $rootScope.$watch(translationsLoaded, (newVal) ->
    if newVal
      translationsDeferred.resolve({
        productTranslations: DomWorker.$Translations.productTranslations,
        errorTranslations: DomWorker.$Translations.errorTranslations
      })
  ).bind(_self)

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
          )
        )
      else
        _.each(item, (subValue, subKey) ->
          if angular.isObject(subValue)
            getNextValue(subValue)
          else
            item[subKey] = parseValues(subKey, item[subKey])
        )

    _.each(values, (value, key) ->
      if angular.isObject(value)
        getNextValue(value)
      else
        values[key] = parseValues(key, values[key])
    )

    values

  return @
