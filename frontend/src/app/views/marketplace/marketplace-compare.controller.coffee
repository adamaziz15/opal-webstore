angular.module('mnoEnterpriseAngular')
  .controller('DashboardMarketplaceCompareCtrl', ($scope, $stateParams, $state, MnoeMarketplace, MnoeConfig) ->

    vm = this

    # Enabling pricing
    vm.isPriceShown = MnoeConfig.isMarketplacePricingEnabled()
    # Enabling reviews
    vm.isReviewingEnabled = MnoeConfig.areMarketplaceReviewsEnabled()

    #====================================
    # Initialization
    #====================================
    vm.isLoading = true

    currency = MnoeConfig.marketplaceCurrency()
    vm.pricing_plans = [currency] || 'AUD' || 'default'

    loadCurrencyData = (product, app) ->
      app.dataLoading = app.blueSkyFlag = true
      MnoeMarketplace.fetchCustomSchema(product.id, {}).then(
        (response) ->
          app.currenciesList = JSON.parse(response)?.currencies_list || []
      ).finally(-> app.dataLoading = false)

    #====================================
    # Calls
    #====================================
    MnoeMarketplace.getApps().then(
      (response) ->
        response = response.plain()
        # Filter apps selected
        vm.comparedApps = _.each(
          _.filter(response.apps, (app)-> app.toCompare == true),
            (app) ->  # Round average rating
              product = _.find(response.products, { nid: app.nid })
              loadCurrencyData(product, app) if product.js_editor_enabled
              app.average_rating = if app.average_rating? then parseFloat(app.average_rating).toFixed(1)
              true
        )

        vm.isLoading = false
    )

    return
  )
