angular.module 'mnoEnterpriseAngular'
  .controller('ProvisioningOrderCtrl', ($scope, $q, $state, $stateParams, MnoeOrganizations, MnoeMarketplace, MnoeProvisioning, MnoeConfig, PRICING_TYPES, ProvisioningHelper, toastr) ->

    vm = this
    vm.isLoading = true
    vm.subscription = MnoeProvisioning.getCachedSubscription()
    vm.selectedCurrency = ""
    vm.filteredPricingPlans = []
    vm.isCurrencySelectionEnabled = MnoeConfig.isCurrencySelectionEnabled()
    vm.pricedPlan = ProvisioningHelper.pricedPlan
    urlParams = {
      productId: $stateParams.productId,
      subscriptionId: $stateParams.subscriptionId,
      editAction: $stateParams.editAction,
      cart: $stateParams.cart
    }
    vm.skipPriceSelection = ProvisioningHelper.skipPricingPlans

    vm.next = (subscription, currency) ->
      MnoeProvisioning.setSubscription(subscription)
      MnoeProvisioning.setSelectedCurrency(currency)
      if vm.subscription.product.custom_schema?
        $state.go('home.provisioning.additional_details', urlParams, { reload: true })
      else
        $state.go('home.provisioning.confirm', urlParams, { reload: true })

    vm.next = (subscription, currency) ->
      MnoeProvisioning.setSubscription(subscription)
      MnoeProvisioning.setSelectedCurrency(currency)
      if vm.subscription.product.custom_schema?
        $state.go('home.provisioning.additional_details', urlParams, { reload: true })
      else
        $state.go('home.provisioning.confirm', urlParams, { reload: true })

    fetchSubscription = () ->
      orgPromise = MnoeOrganizations.get()
      initPromise = MnoeProvisioning.initSubscription({productId: $stateParams.productId, subscriptionId: $stateParams.subscriptionId, cart: urlParams.cart})

      $q.all({organization: orgPromise, subscription: initPromise}).then(
        (response) ->
          vm.orgCurrency = response.organization.organization?.billing_currency || MnoeConfig.marketplaceCurrency()
          vm.subscription = response.subscription
        )
    # Filters the pricing plans not containing current currency
    vm.filterPricingPlans = () ->
      vm.filteredPricingPlans = ProvisioningHelper.plansForCurrency(vm.subscription.product.pricing_plans, vm.selectedCurrency)

    selectDefaultCurrency = () ->
      vm.selectedCurrency = if vm.subscription.currency
        vm.subscription.currency
      else if !vm.currencies.includes(vm.orgCurrency) && vm.isCurrencySelectionEnabled
        vm.currencies[0]
      else
        vm.orgCurrency

    fetchProduct = () ->
      # When in edit mode, we will be getting the product ID from the subscription, otherwise from the url.
      vm.productId = vm.subscription.product?.id || $stateParams.productId
      MnoeMarketplace.getProduct(vm.productId).then(
        (response) ->
          vm.subscription.product = response
          vm.bsEditorEnabled = response.js_editor_enabled
          # Get all the possible currencies
          populateCurrencies()
          selectDefaultCurrency()

          # Filters the pricing plans not containing current currency
          vm.filterPricingPlans()

          MnoeProvisioning.setSubscription(vm.subscription)
        )

    fetchCustomSchema = () ->
      MnoeMarketplace.fetchCustomSchema(vm.productId, { editAction: $stateParams.editAction }).then((response) ->
        vm.subscription.product.custom_schema = response
      )

    populateCurrencies = () ->
      currenciesArray = []
      _.forEach(vm.subscription.product.pricing_plans,
        (pp) -> _.forEach(pp.prices, (p) -> currenciesArray.push(p.currency)))
      vm.currencies = _.uniq(currenciesArray)

    handleRedirect = () ->
      # If bsEditor is enabled, set subscription currency and skip plan selection
      if vm.bsEditorEnabled
        vm.subscription.currency = vm.orgCurrency
        vm.next(vm.subscription, vm.orgCurrency)
      else if ProvisioningHelper.skipPriceSelection(vm.subscription.product)
        vm.next(vm.subscription, vm.selectedCurrency)

    vm.isLoading = true
    if _.isEmpty(vm.subscription)
      fetchSubscription()
        .then(fetchProduct)
        .then(fetchCustomSchema)
        .then(handleRedirect)
        .catch((error) ->
          toastr.error('mno_enterprise.templates.dashboard.provisioning.subscriptions.product_error')
          $state.go('home.subscriptions', {subType: if urlParams.cart then 'cart' else 'active'})
        )
        .finally(() -> vm.isLoading = false)
    else
      vm.bsEditorEnabled = vm.subscription.product.js_editor_enabled
      # Skip this view when subscription plan is not editable
      if ProvisioningHelper.skipPriceSelection(vm.subscription.product) || vm.bsEditorEnabled
        vm.next(vm.subscription, vm.subscription.currency)
      # Grab subscription's selected pricing plan's currency, then filter currencies.
      vm.orgCurrency = MnoeProvisioning.getSelectedCurrency()
      populateCurrencies()
      selectDefaultCurrency()
      vm.filterPricingPlans()

      vm.isLoading = false

    vm.select_plan = (pricingPlan)->
      vm.subscription.product_pricing = pricingPlan
      vm.subscription.max_licenses ||= 1 if vm.subscription.product_pricing.license_based

    vm.subscriptionPlanText = switch $stateParams.editAction.toLowerCase()
      when 'provision'
        'mno_enterprise.templates.dashboard.provisioning.order.provision_title'
      when 'change'
        'mno_enterprise.templates.dashboard.provisioning.order.change_title'

    vm.selectPlan = (pricingPlan)->
      vm.subscription.product_pricing = pricingPlan
      if vm.subscription.product_pricing.license_based
        vm.subscription.max_licenses ||= 1
      else
        # Reset max licenses, as they may have already been set on the subscription
        vm.subscription.max_licenses = null

    # Delete the cached subscription when we are leaving the subscription workflow.
    $scope.$on('$stateChangeStart', (event, toState) ->
      switch toState.name
        when "home.provisioning.confirm", "home.provisioning.order_summary", "home.provisioning.additional_details"
          null
        else
          MnoeProvisioning.setSubscription({})
    )
    return
  )
