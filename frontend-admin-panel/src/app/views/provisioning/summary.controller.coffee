@App.controller('ProvisioningSummaryCtrl', ($q, $scope, $stateParams, MnoeOrganizations, MnoeProvisioning, MnoeAdminConfig, ProvisioningHelper) ->
  vm = this

  orgPromise = MnoeOrganizations.get($stateParams.orgId)
  vm.subscription = MnoeProvisioning.getCachedSubscription()
  vm.selectedCurrency = MnoeProvisioning.getSelectedCurrency()
  vm.quoteBased = false
  subPromise = if _.isEmpty(vm.subscription)
    MnoeProvisioning.initSubscription({productId: $stateParams.productId, orgId: $stateParams.orgId, subscriptionId: $stateParams.subscriptionId})
  else
    $q.resolve(vm.subscription)

  vm.pricedPlan = ProvisioningHelper.pricedPlan
  vm.orderTypeText = 'mnoe_admin_panel.dashboard.provisioning.subscriptions.' + $stateParams.editAction.toLowerCase()

  vm.isLoading = true
  $q.all({organization: orgPromise, subscription: subPromise}).then(
    (response) ->
      vm.orgCurrency = response.organization.data.billing_currency || MnoeAdminConfig.marketplaceCurrency()
      vm.subscription = response.subscription
      vm.singleBilling = vm.subscription.product.single_billing_enabled
      vm.billedLocally = vm.subscription.product.billed_locally
      vm.quoteBased = vm.subscription.product_pricing?.quote_based
      vm.quote = MnoeProvisioning.getCachedQuote() if vm.quoteBased
      vm.bsEditorEnabled = vm.subscription.product.js_editor_enabled
  ).finally(-> vm.isLoading = false)

  vm.pricingText = () ->
    if !vm.singleBilling
      'mnoe_admin_panel.dashboard.provisioning.summary.pricing_info.single_billing_disabled'
    else if vm.billedLocally
      'mnoe_admin_panel.dashboard.provisioning.summary.pricing_info.billed_locally'
    else
      'mnoe_admin_panel.dashboard.provisioning.summary.pricing_info.externally_managed'

  # Delete the cached subscription.
  $scope.$on('$stateChangeStart', (event, toState) ->
    MnoeProvisioning.setSubscription({})
  )

  return
)
