@App.controller('ProvisioningOrderCtrl', ($scope, $q, $state, $stateParams, MnoeOrganizations, MnoeProvisioning, MnoeAdminConfig, ProvisioningHelper, MnoeProducts, toastr) ->

  vm = this
  vm.subscription = MnoeProvisioning.getCachedSubscription()
  vm.isLoading = true
  vm.selectedCurrency = ""
  vm.filteredPricingPlans = []
  vm.isCurrencySelectionEnabled = MnoeAdminConfig.isCurrencySelectionEnabled()
  vm.currenciesList = []
  vm.pricedPlan = ProvisioningHelper.pricedPlan

  urlParams = {
    productId: $stateParams.productId,
    orgId: $stateParams.orgId,
    subscriptionId: $stateParams.subscriptionId,
    editAction: $stateParams.editAction,
    cart: $stateParams.cart
  }

  vm.selectPlan = (pricingPlan) ->
    vm.subscription.product_pricing = pricingPlan
    if vm.subscription.product_pricing.license_based
      vm.subscription.max_licenses ||= 1
    else
      vm.subscription.max_licenses = null

  vm.next = (subscription, currency) ->
    MnoeProvisioning.setSubscription(subscription)
    MnoeProvisioning.setSelectedCurrency(currency)
    if vm.subscription.product.custom_schema?
      $state.go('dashboard.provisioning.additional_details', urlParams, { reload: true })
    else
      $state.go('dashboard.provisioning.confirm', urlParams, { reload: true })

  fetchSubscription = () ->
    orgPromise = MnoeOrganizations.get($stateParams.orgId)
    initPromise = MnoeProvisioning.initSubscription({productId: $stateParams.productId, subscriptionId: $stateParams.subscriptionId, orgId: $stateParams.orgId, cart: urlParams.cart})

    $q.all({organization: orgPromise, subscription: initPromise}).then((response) ->
      vm.orgCurrency = response.organization.data.billing_currency || MnoeAdminConfig.marketplaceCurrency()
      vm.subscription = response.subscription
      vm.subscription.organization_id = response.organization.data.id
    )

  # Set currencies from BS Response if it is a BS product
  loadBSBasedCurrencies = ->
    if vm.subscription.product.js_editor_enabled
      vm.currenciesList = JSON.parse(vm.subscription.product.custom_schema)?.currencies_list || []

  populateCurrencies = () ->
    currenciesArray = []
    _.forEach(vm.subscription.product.product_pricings,
      (pp) -> _.forEach(pp.prices, (p) -> currenciesArray.push(p.currency)))
    vm.currencies = _.uniq(currenciesArray)

  vm.filterCurrencies = () ->
    vm.filteredPricingPlans = _.filter(vm.subscription.product.product_pricings,
      (pp) -> !vm.pricedPlan(pp) || _.some(pp.prices, (p) -> p.currency == vm.selectedCurrency)
    )

  selectDefaultCurrency = () ->
    vm.selectedCurrency = if MnoeProvisioning.getSelectedCurrency()
      MnoeProvisioning.getSelectedCurrency()
    else if vm.subscription.currency
      vm.subscription.currency
    else if !vm.currencies.includes(vm.orgCurrency) && vm.isCurrencySelectionEnabled
      vm.currencies[0]
    else
      vm.orgCurrency


  fetchProduct = () ->
    # When in edit mode, we will be getting the product ID from the subscription, otherwise from the url.
    vm.productId = vm.subscription.product?.id || $stateParams.productId
    MnoeProvisioning.getProduct(vm.productId, urlParams.orgId, { editAction: $stateParams.editAction }).then(
      (response) ->
        vm.subscription.product = response
        vm.bsEditorEnabled = vm.subscription.product.js_editor_enabled
        populateCurrencies()
        selectDefaultCurrency()
        # Filters the pricing plans not available in the selected currency
        vm.filterCurrencies()
        MnoeProvisioning.setSubscription(vm.subscription)
    )

  fetchCustomSchemaAndCurrency = () ->
    MnoeProducts.fetchCustomSchema(vm.productId, { editAction: $stateParams.editAction }).then((response) ->
      # Some products have custom schemas, whereas others do not.
      vm.subscription.product.custom_schema = response
      loadBSBasedCurrencies()
    )

  handleRedirect = () ->
    if vm.bsEditorEnabled
      if vm.orgCurrency in vm.currenciesList
        vm.subscription.currency = vm.orgCurrency
        vm.next(vm.subscription, vm.orgCurrency)
      else
        # Reset all plan related data and prevent user from moving to next step
        vm.subscription.product.product_pricings = []
        vm.currencies = []
        vm.filteredPricingPlans = []
    else if ProvisioningHelper.skipPriceSelection(vm.subscription.product)
      vm.next(vm.subscription)

  vm.isLoading = true
  if _.isEmpty(vm.subscription)
    fetchSubscription()
      .then(fetchProduct)
      .then(fetchCustomSchemaAndCurrency)
      .then(handleRedirect)
      .catch((error) ->
        toastr.error('mnoe_admin_panel.dashboard.provisioning.subscriptions.product_error')
        $state.go('dashboard.customers.organization', {orgId: $stateParams.orgId})
        )
      .finally(() -> vm.isLoading = false)
  else
    vm.bsEditorEnabled = vm.subscription.product.js_editor_enabled
    # Grab subscription's selected pricing plan's currency, then filter currencies.
    vm.orgCurrency = MnoeProvisioning.getSelectedCurrency()
    populateCurrencies()
    selectDefaultCurrency()
    # Filters the pricing plans not available in the selected currency
    vm.filterCurrencies()
    loadBSBasedCurrencies()
    # Skip this view when subscription plan is not editable
    if ProvisioningHelper.skipPriceSelection(vm.subscription.product)
      vm.next(vm.subscription, vm.subscription.currency)
    if vm.bsEditorEnabled
      if vm.orgCurrency && (vm.orgCurrency in vm.currenciesList)
        vm.next(vm.subscription, vm.orgCurrency)
      else
        delayLoader = true
        orgPromise = MnoeOrganizations.get($stateParams.orgId).then(
          (response) ->
            vm.next(vm.subscription, response.data.billing_currency) if (response.data.billing_currency in vm.currenciesList)
        ).finally(-> vm.isLoading = false)

    vm.isLoading = false unless delayLoader

  vm.subscriptionPlanText = switch $stateParams.editAction.toLowerCase()
    when 'provision'
      'mnoe_admin_panel.dashboard.provisioning.order.provision_title'
    when 'change'
      'mnoe_admin_panel.dashboard.provisioning.order.change_title'

  # Delete the cached subscription when we are leaving the subscription workflow.
  $scope.$on('$stateChangeStart', (event, toState) ->
    switch toState.name
      when "dashboard.provisioning.confirm", "dashboard.provisioning.order_summary", "dashboard.provisioning.additional_details"
        null
      else
        MnoeProvisioning.setSubscription({})
  )

  return
)
