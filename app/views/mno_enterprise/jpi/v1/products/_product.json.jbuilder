json.extract! product, :id, :nid, :name, :active, :product_type, :logo, :external_id, :externally_provisioned, :free_trial_enabled, :free_trial_duration, :free_trial_unit, :local, :single_billing_enabled, :billed_locally

json.values_attributes do
  json.array! product.values.each do |value|
    json.extract! value, :data
    json.name value.field.name
  end if product.respond_to?(:values)
end

json.assets_attributes do
  json.array! product.assets.each do |asset|
    json.extract! asset, :id, :url, :field_name
  end if product.respond_to?(:assets)
end

json.pricing_plans do
  json.array! product.pricing_plans.each do |pricing|
    json.extract! pricing, :id, :name, :description, :position, :free, :license_based, :pricing_type, :free_trial_enabled, :free_trial_duration, :free_trial_unit, :per_duration, :per_unit, :prices, :external_id, :quote_based
  end if product.respond_to?(:pricing_plans)
end

json.js_editor_enabled product.external_id.in? Settings.bluesky_products.to_a

