@App.controller('ProvisioningSummaryCtrl', ($q, $scope, $stateParams, MnoeOrganizations, MnoeProvisioning, MnoeAdminConfig, ProvisioningHelper, MnoeBlueSky) ->
  vm = this

  orgPromise = MnoeOrganizations.get($stateParams.orgId)
  vm.subscription = MnoeProvisioning.getCachedSubscription()
  vm.selectedCurrency = MnoeProvisioning.getSelectedCurrency()
  vm.quoteBased = false
  vm.quoteFetched = false
  vm.dataLoading = true
  subPromise = if _.isEmpty(vm.subscription)
    MnoeProvisioning.initSubscription({productId: $stateParams.productId, orgId: $stateParams.orgId, subscriptionId: $stateParams.subscriptionId})
  else
    $q.resolve(vm.subscription)

  vm.pricedPlan = ProvisioningHelper.pricedPlan

  setSchemaReadOnlyData = ->
    vm.editor = MnoeBlueSky.getCachedBSEditor()
    return if _.isEmpty(vm.editor)
    vm.dataLoading = false

  vm.isLoading = true
  $q.all({organization: orgPromise, subscription: subPromise}).then(
    (response) ->
      vm.orgCurrency = response.organization.data.billing_currency || MnoeAdminConfig.marketplaceCurrency()
      vm.subscription = response.subscription
      vm.quoteBased = vm.subscription.product_pricing?.quote_based || vm.subscription.product?.js_editor_enabled
      vm.quote = MnoeProvisioning.getCachedQuote() if vm.quoteBased
      vm.quoteFetched = true
      vm.bsEditorEnabled = vm.subscription.product.js_editor_enabled
      setSchemaReadOnlyData() if vm.bsEditorEnabled
  ).finally(-> vm.isLoading = false)

  # Delete the cached subscription.
  $scope.$on('$stateChangeStart', (event, toState) ->
    MnoeProvisioning.setSubscription({})
  )

  return
)
