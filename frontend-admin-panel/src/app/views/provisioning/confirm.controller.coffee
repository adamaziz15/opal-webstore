@App.controller('ProvisioningConfirmCtrl', ($scope, $q, $log, $state, $stateParams, MnoeOrganizations, MnoeProvisioning, MnoeAdminConfig, ProvisioningHelper, MnoeBlueSky, MnoConfirm, schemaForm) ->
  vm = this

  vm.isLoading = true
  vm.dataLoading = true
  orgPromise = MnoeOrganizations.get($stateParams.orgId)
  vm.subscription = MnoeProvisioning.getCachedSubscription()
  vm.selectedCurrency = MnoeProvisioning.getSelectedCurrency() || vm.subscription.currency
  vm.bsEditorEnabled = vm.subscription?.product?.js_editor_enabled
  vm.nonSchemaAction = $stateParams.editAction in (vm.subscription.non_schema_actions || [])
  vm.cartItem = $stateParams.cart == 'true'
  vm.quoteFetched = true
  vm.quoteBased = false

  vm.editOrder = (reload = false) ->
    params = {
      productId: $stateParams.productId,
      orgId: $stateParams.orgId
      subscriptionId: $stateParams.subscriptionId,
      editAction: $stateParams.editAction,
      cart: $stateParams.cart
    }

    switch $stateParams.editAction.toLowerCase()
      when 'change', 'provision', null
        $state.go('dashboard.provisioning.order', params, {reload: reload})
      else
        $state.go('dashboard.provisioning.additional_details', params, {reload: reload})

  setupNewForm = ->
    return if vm.nonSchemaAction
    vm.editor = MnoeBlueSky.getCachedBSEditor()
    vm.editorValues = vm.editor.getValue()

  setCustomSchema = () ->
    parsedSchema = JSON.parse(vm.subscription.product.custom_schema)
    schema = parsedSchema.json_schema || parsedSchema
    vm.form = parsedSchema.asf_options || ["*"]
    schemaForm.jsonref(schema)
      .then((schema) -> schemaForm.jsonref(schema))
      .then((schema) -> schemaForm.jsonref(schema))
      .then((schema) ->
        vm.schema = schema
        setupNewForm() if vm.bsEditorEnabled
      ).finally(-> vm.dataLoading = false)

  fetchQuote = ->
    vm.quote = MnoeProvisioning.getCachedQuote()
    if _.isEmpty(vm.quote)
      MnoeProvisioning.getQuote(vm.subscription, vm.selectedCurrency, $stateParams.editAction).then(
        (response) ->
          vm.quote = response.data
          # To be passed to the order summary screen.
          MnoeProvisioning.setQuote(vm.quote)
        (error) ->
          vm.quoteFetched = true
          $log.error('Error while fetching quote', error)
      ).finally(-> vm.quoteFetched = true)
    else
      vm.quoteFetched = true

  # Do not fetch quotes for non schema actions
  if (vm.subscription.product_pricing?.quote_based || vm.bsEditorEnabled) && !vm.nonSchemaAction
    vm.quoteBased = true
    vm.quoteFetched = false
    fetchQuote()

  # Happen when the user reload the browser during the provisioning
  if _.isEmpty(vm.subscription)
    # Redirect the user to the first provisioning screen
    vm.editOrder(true)
  else
    vm.singleBilling = vm.subscription.product.single_billing_enabled
    vm.billedLocally = vm.subscription.product.billed_locally
    # Render custom Schema if it exists
    setCustomSchema() if vm.subscription.custom_data && vm.subscription.product.custom_schema

  vm.orderTypeText = 'mnoe_admin_panel.dashboard.provisioning.subscriptions.' + $stateParams.editAction.toLowerCase()

  vm.orderEditable = () ->
    # The order is editable if we are changing the plan, or the product has a custom schema.
    return true if vm.subscription.product?.custom_schema
    # Disable editing if unable to initially select a pricing plan.
    return false if ProvisioningHelper.skipPriceSelection(vm.subscription.product)
    switch $stateParams.editAction.toLowerCase()
      when 'change', 'provision'
        true
      else
        false

  $q.all({organization: orgPromise}).then(
    (response) ->
      vm.orgCurrency = response.organization.data.billing_currency || MnoeAdminConfig.marketplaceCurrency()
  ).finally(-> vm.isLoading = false)

  vm.confirmAction = (action) ->
    switch action
      when 'validate'
        vm.validate()
      when 'cart'
        vm.addToCart()

  # Conditions are:
  #   Pricing plan currency is not same as billing currency
  #   Subscription does not exist(we only want disclaimer when creating a new subscription)
  vm.disclaimerAndConfirm = (action) ->
    # Check if product is a single billed bluesky product
    singleBilledBlueskyProduct = vm.subscription.product.js_editor_enabled && (vm.subscription.product.external_id not in ['SEPC', 'SYMANTECWEBSECURITY', 'SYMANTECEMAILSECURITY'])
    # Show currency disclaimer any time a new order is being placed in a currency other than the organization billing currency
    hasPricedPlan = (vm.subscription.product_pricing && ProvisioningHelper.pricedPlan(vm.subscription.product_pricing)) || singleBilledBlueskyProduct
    showCurrencyDisclaimer = hasPricedPlan && vm.selectedCurrency != vm.orgCurrency && !vm.subscription.id
    # Show billing disclaimer when an order is being placed for a product that is billed outside the platform
    showBillingDisclaimer = !vm.subscription.product.single_billing_enabled || (vm.subscription.product.js_editor_enabled && !singleBilledBlueskyProduct)
    # Show disclaimer when ordering a usage based local product
    showLocalUsageDisclaimer = vm.subscription.product.local && (vm.subscription.product_pricing?.pricing_type == 'payg')
    if showCurrencyDisclaimer || showBillingDisclaimer || showLocalUsageDisclaimer
      disclaimerType = if showCurrencyDisclaimer
        'currency_disclaimer'
      else if showBillingDisclaimer
        'billing_disclaimer'
      else
        vm.selectedCurrency = vm.orgCurrency
        'usage_disclaimer'

      modalOptions =
        closeButtonText: 'mnoe_admin_panel.dashboard.provisioning.confirm.disclaimer.cancel'
        actionButtonText: 'mnoe_admin_panel.dashboard.provisioning.confirm.disclaimer.ok'
        headerText: 'mnoe_admin_panel.dashboard.provisioning.confirm.disclaimer.header'
        bodyText: 'mnoe_admin_panel.dashboard.provisioning.confirm.' + disclaimerType + '.body'
        bodyTextExtraData: { currency: vm.selectedCurrency }
        type: 'danger'

      MnoConfirm.showModal(modalOptions).then(
        ->
          # Success
          vm.confirmAction(action)
        ->
          # Error
          return false
      )
    else
      vm.confirmAction(action)

  vm.validate = () ->
    vm.isLoading = true
    vm.subscription.event_type = $stateParams.editAction
    vm.subscription.custom_data = {} if vm.nonSchemaAction
    if vm.cartItem
      vm.subscription.cart_entry = true
      provisioningPromise = MnoeProvisioning.saveSubscriptionCart(vm.subscription, vm.selectedCurrency, $stateParams.orgId)
    else
      provisioningPromise = MnoeProvisioning.saveSubscription(vm.subscription, vm.selectedCurrency, $stateParams.orgId)

    provisioningPromise.then((subscription) ->
      if vm.cartItem
        $state.go("dashboard.customers.organization", {orgId: $stateParams.orgId})
      else
        $state.go('dashboard.provisioning.order_summary', {orgId: $stateParams.orgId, subscriptionId: subscription.id, editAction: $stateParams.editAction})
    ).finally(-> vm.isLoading = false)

  vm.cancel = ->
    $state.go('dashboard.customers.organization', {orgId: $stateParams.orgId})

  vm.addToCart = ->
    vm.isLoading = true
    vm.subscription.cart_entry = true
    vm.subscription.custom_data = {} if vm.nonSchemaAction
    MnoeProvisioning.saveSubscriptionCart(vm.subscription, vm.selectedCurrency, $stateParams.orgId).then(
      (response) ->
        $state.go('dashboard.customers.organization', {orgId: $stateParams.orgId})
     ).finally(-> vm.isLoading = false)

  # Delete the cached subscription when we are leaving the subscription workflow.
  $scope.$on('$stateChangeStart', (event, toState) ->
    switch toState.name
      when "dashboard.provisioning.order", "dashboard.provisioning.order_summary", "dashboard.provisioning.additional_details"
        null
      else
        MnoeProvisioning.setSubscription({})
  )

  vm.pricingText = () ->
    if !vm.singleBilling || vm.subscription.product.js_editor_enabled
      'mnoe_admin_panel.dashboard.provisioning.confirm.pricing_info.single_billing_disabled'
    else if vm.billedLocally
      'mnoe_admin_panel.dashboard.provisioning.confirm.pricing_info.billed_locally'
    else
      'mnoe_admin_panel.dashboard.provisioning.confirm.pricing_info.externally_managed'

  return
)
