@App.controller('ProvisioningDetailsCtrl', ($scope, $q, $state, $stateParams, $filter, MnoeProvisioning, MnoeOrganizations, schemaForm, ProvisioningHelper, MnoeProducts, MnoeBlueSky, toastr) ->
  vm = this
  vm.subscription = MnoeProvisioning.getCachedSubscription()
  vm.schemaCopy = angular.copy vm.subscription.custom_data unless _.isEmpty(vm.subscription)
  vm.enableBSEditor = false

  # We must use model schemaForm's sf-model, as #json_schema_opts are namespaced under model
  vm.model = vm.subscription.custom_data || {}

  # Methods under the vm.model are used for calculated fields under #json_schema_opts, which are set on third-party adapters.
  # Used to calculate the end date for forms with a contractEndDate.
  vm.model.calculateEndDate = (startDate, contractLength) ->
    return null unless startDate && contractLength
    moment(startDate)
    .add(contractLength.split('Months')[0], 'M')
    .format('YYYY-MM-DD')
  # Used for forms that automatically calculate the startDate.
  vm.model.timeNow = () ->
    $filter('date')(new Date(), 'yyyy-MM-dd')

  # Workaround. You can only specify defaults in the schema, and not the vm.form section.
  # Since we are getting the schemas remotely, we must find a way to set defaults using vm.form.
  vm.model.defaultContractLength = () ->
    'monthly'

  urlParams =
    orgId: $stateParams.orgId,
    subscriptionId: $stateParams.subscriptionId,
    productId: $stateParams.productId,
    editAction: $stateParams.editAction,
    cart: $stateParams.cart

  # Pricing does not need to be chosen if pricing can be skipped, or if you have already chosen a pricing.
  skipPricing = () ->
    vm.subscription.product_pricing || ProvisioningHelper.skipPriceSelection(vm.subscription.product)

  handleRedirect = (product) ->
    # If there is no custom schema and pricings are skipped -- go directly to the confirm page.
    if skipPricing()
      $state.go('dashboard.provisioning.confirm', urlParams, {reload: true})
    # Default: If we can't skip pricings, we must go back to the order page to choose a price. Happens when we reload page on a new order.
    else
      $state.go('dashboard.provisioning.order', urlParams, {reload: true})

  loadSessionData = ->
    monthNames = [
      'January'
      'February'
      'March'
      'April'
      'May'
      'June'
      'July'
      'August'
      'September'
      'October'
      'November'
      'December'
    ]
    monthNamesShort = [
      'Jan'
      'Feb'
      'Mar'
      'Apr'
      'May'
      'Jun'
      'Jul'
      'Aug'
      'Sep'
      'Oct'
      'Nov'
      'Dec'
    ]
    dayNames = [
      'Sunday'
      'Monday'
      'Tuesday'
      'Wednesday'
      'Thursday'
      'Friday'
      'Saturday'
    ]
    dayNamesShort = [
      'Sun'
      'Mon'
      'Tue'
      'Wed'
      'Thu'
      'Fri'
      'Sat'
    ]
    sessionStorage.setItem 'monthNames', JSON.stringify(monthNames)
    sessionStorage.setItem 'monthNamesShort', JSON.stringify(monthNamesShort)
    sessionStorage.setItem 'dayNames', JSON.stringify(dayNames)
    sessionStorage.setItem 'dayNamesShort', JSON.stringify(dayNamesShort)

  fetchTranslations = ->
    defer = $q.defer()
    if !vm.enableBSEditor
      defer.resolve(false)
      return defer.promise

    MnoeBlueSky.getSchemaTranslation().then(
      (response) ->
        vm.errorTranslations = JSON.parse(response.data.error_translations)
        vm.productTranslations = JSON.parse(response.data.product_translations)
    )

  # TODO: Move this to a BS Editor Helper
  formValidation = (errorsLength, values) ->
    if errorsLength == 0
      # call bluesky api here for price calculation
      vm.editorValid = true
    else
      vm.editorValid = false

  setupNewForm = ->
    # TODO: Move this to a helper/service as it's just static data
    loadSessionData()

    vm.schemaDetails =
      schema: vm.schema
      editor: null

    vm.formValidation = formValidation

  # The schema is contained in field vm.product.custom_schema
  #
  # jsonref is used to resolve $ref references
  # jsonref is not cyclic at this stage hence the need to make a
  # reasonable number of passes (2 below + 1 in the sf-schema directive)
  # to resolve cyclic references
  setCustomSchema = (product) ->
    # If there is a custom schema and we can skip pricing, stay on this page.
    return handleRedirect(product) unless product.custom_schema && skipPricing()

    # Set BS Editor flag
    if product.js_editor_enabled
      vm.enableBSEditor = true
      vm.schemaCopy = angular.copy vm.subscription.custom_data if urlParams.editAction != 'new' && _.isEmpty(vm.schemaCopy)
    vm.model = vm.subscription.custom_data || {}
    parsedSchema = JSON.parse(product.custom_schema)
    schema = parsedSchema.json_schema || parsedSchema
    vm.form = parsedSchema.asf_options || ["*"]
    schemaForm.jsonref(schema)
      .then((schema) -> schemaForm.jsonref(schema))
      .then((schema) -> schemaForm.jsonref(schema))
      .then((schema) ->
        vm.schema = schema
        # Load BS Editor data
        setupNewForm() if vm.enableBSEditor
        )

  fetchSubscription = () ->
    orgPromise = MnoeOrganizations.get(urlParams.orgId)
    initPromise = MnoeProvisioning.initSubscription({productId: urlParams.productId, subscriptionId: urlParams.subscriptionId, orgId: urlParams.orgId, cart: urlParams.cart})
    $q.all({organization: orgPromise, subscription: initPromise}).then((response) ->
      vm.orgCurrency = response.organization.data.billing_currency || MnoeAdminConfig.marketplaceCurrency()
      vm.subscription = response.subscription
      vm.subscription.organization_id = response.organization.data.id
    )

  filterCurrencies = (productPricings) ->
    _.filter(productPricings,
      (pp) -> !ProvisioningHelper.pricedPlan(pp) || _.some(pp.prices, (p) -> p.currency == vm.orgCurrency)
    )

  fetchProduct = () ->
    # When in edit mode, we will be getting the product ID from the subscription, otherwise from the url.
    vm.productId = vm.subscription.product?.id || urlParams.productId

    MnoeProvisioning.getProduct(vm.productId, { editAction: urlParams.editAction }).then(
      (response) ->
        vm.subscription.product = response
        # Filters the pricing plans not containing current currency
        vm.subscription.product.product_pricings = filterCurrencies(vm.subscription.product.product_pricings)
        MnoeProvisioning.setSubscription(vm.subscription)
    )

  fetchCustomSchema = () ->
    MnoeProducts.fetchCustomSchema(vm.productId, { editAction: urlParams.editAction }).then((response) ->
      vm.subscription.product.custom_schema = response
      )

  vm.isLoading = true
  if _.isEmpty(vm.subscription)
    fetchSubscription().then(fetchProduct).then(fetchCustomSchema)
      .then(() -> setCustomSchema(vm.subscription.product))
      .catch((error) ->
        toastr.error('mnoe_admin_panel.dashboard.provisioning.subscriptions.product_error')
        $state.go('dashboard.customers.organization', {orgId: urlParams.orgId})
        )
      .finally(() ->
        fetchTranslations().then(-> vm.isLoading = false)
      )
  else
    setCustomSchema(vm.subscription.product)
      .catch((error) ->
        toastr.error('mnoe_admin_panel.dashboard.provisioning.subscriptions.product_error')
      )
      .finally(() ->
        fetchTranslations().then(-> vm.isLoading = false)
      )

  vm.submit = (form) ->
    if vm.enableBSEditor
      vm.subscription.custom_data = form
    else
      $scope.$broadcast('schemaFormValidate')
      return unless form.$valid
      vm.subscription.custom_data = vm.model

    MnoeProvisioning.setSubscription(vm.subscription)
    $state.go('dashboard.provisioning.confirm', urlParams)

  vm.editPlanText = 'mnoe_admin_panel.dashboard.provisioning.details.' + urlParams.editAction.toLowerCase() + '_title'

  # Delete the cached subscription when we are leaving the subscription workflow.
  $scope.$on('$stateChangeStart', (event, toState) ->
    switch toState.name
      when "dashboard.provisioning.order", "dashboard.provisioning.order_summary", "dashboard.provisioning.confirm"
        null
      else
        MnoeProvisioning.setSubscription({})
  )

  return
)