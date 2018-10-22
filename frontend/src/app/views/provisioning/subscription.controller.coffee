angular.module 'mnoEnterpriseAngular'
  .controller('ProvisioningSubscriptionCtrl', ($stateParams, $state, $filter, $uibModal, $window, $q, MnoeProvisioning, MnoeMarketplace, MnoeBlueSky, ProvisioningHelper) ->

    vm = this

    vm.isLoading = true
    vm.dataLoading = true
    # We must use model schemaForm's sf-model, as #json_schema_opts are namespaced under model
    vm.model = {}
    # Methods under the vm.model are used for calculated fields under #json_schema_opts.

    # Used to calculate the end date for forms with a contractEndDate.
    vm.model.calculateEndDate = (startDate, contractLength) ->
      return null unless startDate && contractLength
      moment(startDate)
      .add(contractLength.split('Months')[0], 'M')
      .format('YYYY-MM-DD')

    # Preload the BS JSON Editor to retrieve the editor instance
    loadHiddenEditorData = ->
      vm.schemaCopy = MnoeBlueSky.parseJsonEditorValues(angular.copy(vm.subscription.custom_data), true)
      vm.requestedSchemaCopy = MnoeBlueSky.parseJsonEditorValues(angular.copy(vm.order.subscription_details?.custom_data), true)
      MnoeBlueSky.getSchemaTranslations().then(
        () ->
          vm.schemaDetails =
            schema: vm.schema
            editor: null
          vm.requestedSchemaDetails =
            schema: vm.requestedSchema
            editor: null
      ).finally(-> vm.loadHiddenEditor = true)

    subscriptionPromise = MnoeProvisioning.fetchSubscription($stateParams.id, $stateParams.cart).then(
      (response) ->
        vm.subscription = response
        vm.enableBSEditor = vm.subscription.product.js_editor_enabled
        unless _.isEmpty(vm.subscription.custom_data)
          vm.model = vm.subscription.custom_data

          MnoeMarketplace.fetchCustomSchema(vm.subscription.product_id).then((response) ->
            # Some products have custom schemas, whereas others do not.
            resp = JSON.parse(response)
            vm.form = resp?.asf_options || ["*"]
            vm.schema = resp?.json_schema || resp
          )
    )

    eventPromise = MnoeProvisioning.getSubscriptionEvents($stateParams.id, 'created_at.desc').then(
      (response) ->
        vm.subscriptionEvents = response
        vm.order = vm.subscriptionEvents[0]
    )

    $q.all([subscriptionPromise, eventPromise]).then(
      ->
        unless _.isEmpty(vm.order.subscription_details?.custom_data)
          vm.requestedModel = vm.order.subscription_details.custom_data

          unless vm.order.event_type == 'provision' && !_.isEmpty(vm.subscription.custom_data)
            MnoeMarketplace.fetchCustomSchema(vm.subscription.product_id, { editAction: vm.order.event_type }).then((response) ->
              resp = JSON.parse(response)
              vm.requestedForm = resp?.asf_options || ["*"]
              vm.requestedSchema = resp?.json_schema || resp
            )
          else
            vm.requestedForm = vm.form
            vm.requestedSchema = vm.schema
    ).finally(
      ->
        vm.isLoading = false
        loadHiddenEditorData() if vm.enableBSEditor
    )

    # Configure user friendly json tree
    vm.rootName = $filter('translate')('mno_enterprise.templates.dashboard.provisioning.subscription.provisioning_data_root_name')
    vm.jsonTreeSettings = {
      dateFormat: 'yyyy-MM-dd HH:mm:ss'
    }

    vm.displayInfoTooltip = ->
      return vm.subscription.status == 'aborted'

    vm.displayStatusInfo = ->
      modalInstance = $uibModal.open(
        templateUrl: 'app/views/provisioning/subscription-status-info-modal/subscription-status-info.html'
        controller: 'SubscriptionInfoController'
        controllerAs: 'vm'
      )

    vm.subscriptionBackLink = ->
      $window.history.back()

    vm.setReadOnlyFormVars = (schemaType) ->
      return unless vm.dataLoading

      switch schemaType
        when 'current'
          vm.editor = vm.schemaDetails.editor if _.isEmpty(vm.editor)
          vm.config = vm.schemaDetails.editor.getValue() if _.isEmpty(vm.config)
        when 'requested'
          vm.requestedEditor = vm.requestedSchemaDetails.editor if _.isEmpty(vm.requestedEditor)
          vm.requestedConfig = vm.requestedSchemaDetails.editor.getValue() if _.isEmpty(vm.requestedConfig)

      vm.dataLoading = false if (vm.editor || _.isEmpty(vm.subscription.custom_schema)) && (vm.requestedEditor || !vm.requestedModel)

    # Return true if the plan has a dollar value
    vm.pricedPlan = ProvisioningHelper.pricedPlan

    return
  )
