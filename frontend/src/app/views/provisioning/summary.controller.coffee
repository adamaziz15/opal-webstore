angular.module 'mnoEnterpriseAngular'
  .controller('ProvisioningSummaryCtrl', ($scope, $state, $stateParams, MnoeOrganizations, MnoeProvisioning, MnoeConfig, MnoeBlueSky) ->

    vm = this
    vm.dataLoading = true
    vm.isLoading = true
    vm.quoteBased = false
    vm.quoteFetched = false
    vm.quote = {}
    vm.selectedCurrency = MnoeProvisioning.getSelectedCurrency()
    vm.subType = if $stateParams.cart == 'true' then 'cart' else 'active'
    vm.subscription = MnoeProvisioning.getCachedSubscription()

    setSchemaReadOnlyData = ->
      vm.editor = MnoeBlueSky.getCachedBSEditor()
      vm.dataLoading = false

    initSummary = () ->
      vm.quoteBased = vm.subscription.product_pricing?.quote_based || vm.subscription.product?.js_editor_enabled
      vm.quote = MnoeProvisioning.getCachedQuote() if vm.quoteBased
      vm.quoteFetched = true
      vm.bsEditorEnabled = vm.subscription.product.js_editor_enabled
      setSchemaReadOnlyData() if vm.bsEditorEnabled

    if !_.isEmpty(vm.subscription)
      initSummary()
      vm.isLoading = false
    else
      $state.go("home.subscriptions", { subType: 'active' })

    MnoeOrganizations.get().then(
      (response) ->
        vm.orgCurrency = response.organization?.billing_currency || MnoeConfig.marketplaceCurrency()
    )

    # Delete the cached subscription.
    $scope.$on('$stateChangeStart', (event, toState) ->
      MnoeProvisioning.setSubscription({})
    )

    return
  )
