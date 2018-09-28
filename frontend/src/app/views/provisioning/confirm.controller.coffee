angular.module 'mnoEnterpriseAngular'
  .controller('ProvisioningConfirmCtrl', ($scope, $state, $stateParams, $log, MnoeOrganizations, MnoeProvisioning, MnoeAppInstances, MnoeConfig, ProvisioningHelper, MnoeBlueSky, schemaForm, toastr) ->

    vm = this

    vm.isLoading = false
    vm.dataLoading = true
    vm.subscription = MnoeProvisioning.getCachedSubscription()
    vm.bsEditorEnabled = vm.subscription?.product?.js_editor_enabled
    vm.selectedCurrency = MnoeProvisioning.getSelectedCurrency()
    vm.cartItem = $stateParams.cart == 'true'
    vm.quoteFetched = true
    vm.quoteBased = false

    vm.orderTypeText = 'mno_enterprise.templates.dashboard.provisioning.subscriptions.' + $stateParams.editAction.toLowerCase()

    urlParams =
      subscriptionId: $stateParams.subscriptionId
      productId: $stateParams.productId
      editAction: $stateParams.editAction,
      cart: $stateParams.cart

    setupNewForm = ->
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
        MnoeProvisioning.getQuote(vm.subscription, vm.selectedCurrency).then(
          (response) ->
            vm.quote = response
            # To be passed to the order summary screen.
            MnoeProvisioning.setQuote(response)
          (error) ->
            $log.error(error)
            toastr.error('mno_enterprise.templates.dashboard.marketplace.show.quote_error')
        ).finally(-> vm.quoteFetched = true)
      else
        vm.quoteFetched = true

    vm.editOrder = (reload = true) ->
      switch $stateParams.editAction.toLowerCase()
        when 'change', 'provision', null
          $state.go('home.provisioning.order', urlParams, {reload: reload})
        else
          $state.go('home.provisioning.additional_details', urlParams, {reload: reload})

    if vm.subscription.product_pricing?.quote_based || vm.subscription.product?.js_editor_enabled
      vm.quoteBased = true
      vm.quoteFetched = false
      fetchQuote()

    # Happens when the user reload the browser during the provisioning workflow.
    if _.isEmpty(vm.subscription)
      # Redirect the user to the first provisioning screen
      vm.editOrder(true)
    else
      vm.singleBilling = vm.subscription.product.single_billing_enabled
      vm.billedLocally = vm.subscription.product.billed_locally
      # Render custom Schema if it exists
      setCustomSchema() if vm.subscription.custom_data && vm.subscription.product.custom_schema

    vm.validate = () ->
      vm.isLoading = true
      vm.subscription.event_type = $stateParams.editAction

      if vm.cartItem
        vm.subscription.cart_entry = true
        provisioningPromise = MnoeProvisioning.saveSubscriptionCart(vm.subscription, vm.selectedCurrency)
      else
        provisioningPromise= MnoeProvisioning.saveSubscription(vm.subscription, vm.selectedCurrency)

      provisioningPromise.then((response) ->
        if vm.cartItem
          MnoeProvisioning.refreshCartSubscriptions()
          $state.go("home.subscriptions", {subType: 'cart'})
        else
          # Reload dock apps
          MnoeAppInstances.getAppInstances().then(
            (response) ->
              $scope.apps = response
          )
          $state.go('home.provisioning.order_summary', {subscriptionId: $stateParams.subscriptionId, editAction: $stateParams.editAction, cart: $stateParams.cart})
        ).finally(-> vm.isLoading = false)

    vm.cancel = ->
      $state.go('home.marketplace')

    vm.addToCart = ->
      vm.isLoading = true
      vm.subscription.cart_entry = true
      MnoeProvisioning.saveSubscriptionCart(vm.subscription, vm.selectedCurrency).then(
        (response) ->
          MnoeProvisioning.refreshCartSubscriptions()
          $state.go('home.marketplace')
      ).finally(-> vm.isLoading = false)

    vm.orderEditable = () ->
      # The order is editable if the product has a custom schema.
      return true if vm.subscription.product?.custom_schema
      # Disable editing if unable to initially select a pricing plan.
      return false if ProvisioningHelper.skipPriceSelection(vm.subscription.product)
      switch $stateParams.editAction
        when 'change', 'provision'
          true
        else
          false

    MnoeOrganizations.get().then(
      (response) ->
        vm.orgCurrency = response.organization?.billing_currency || MnoeConfig.marketplaceCurrency()
    )

    vm.pricingText = () ->
      if !vm.singleBilling || vm.subscription.product.js_editor_enabled
        'mno_enterprise.templates.dashboard.provisioning.confirm.pricing_info.single_billing_disabled'
      else if vm.billedLocally
        'mno_enterprise.templates.dashboard.provisioning.confirm.pricing_info.billed_locally'
      else
        'mno_enterprise.templates.dashboard.provisioning.confirm.pricing_info.externally_managed'

    # Delete the cached subscription when we are leaving the subscription workflow.
    $scope.$on('$stateChangeStart', (event, toState) ->
      switch toState.name
        when "home.provisioning.order", "home.provisioning.order_summary", "home.provisioning.additional_details"
          null
        else
          MnoeProvisioning.setSubscription({})
    )

    return
  )
