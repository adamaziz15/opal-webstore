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
      vm.editorValues = vm.editor?.getValue()
      vm.dataLoading = false

    initSummary = () ->
      vm.singleBilling = vm.subscription.product.single_billing_enabled
      vm.billedLocally = vm.subscription.product.billed_locally
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

    vm.orderTypeText = 'mno_enterprise.templates.dashboard.provisioning.subscriptions.' + $stateParams.editAction.toLowerCase()

    MnoeOrganizations.get().then(
      (response) ->
        vm.orgCurrency = response.organization?.billing_currency || MnoeConfig.marketplaceCurrency()
    )

    # Delete the cached subscription.
    $scope.$on('$stateChangeStart', (event, toState) ->
      MnoeProvisioning.setSubscription({})
    )

    vm.pricingText = () ->
      if !vm.singleBilling || vm.subscription.product.js_editor_enabled
        'mno_enterprise.templates.dashboard.provisioning.summary.pricing_info.single_billing_disabled'
      else if vm.billedLocally
        'mno_enterprise.templates.dashboard.provisioning.summary.pricing_info.billed_locally'
      else
        'mno_enterprise.templates.dashboard.provisioning.summary.pricing_info.externally_managed'

    return
  )
