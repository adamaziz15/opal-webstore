FactoryGirl.define do

  # Maestrano User Model
  factory :user, class: 'MnoEnterprise::User' do
    sequence(:email) { |n| "user_#{n}@maestrano.com" }
    sequence(:uid) { |n| "usr-#{n}" }
    name 'BoB'
    surname 'Morane'
    failed_attempts 0
  end

  factory :app, class: MnoEnterprise::App do
    transient { mnoe_tenant_id nil } #compatibility with mnoe api specs
    sequence(:nid) { |n| "app-#{n}" }
    sequence(:name) { |n| "TestApp#{n}" }
    sequence(:account_id) { |n| n }
    description 'This is a description'
    categories ['CRM']
    tags ['Sales']
    active true
    stack 'cube'
    per_user_licence true
    base_price_cents 1000
    base_price_currency 'AUD'
    licence_price_cents 1000
    licence_price_currency 'AUD'
    rank 1000
    trait :cloud do
      stack 'cloud'
    end

    trait :connector do
      stack 'connector'
    end

    trait :trial do
      free_trial_duration 15
    end


    factory :cloud_app, traits: [:cloud, :trial]
    factory :connector_app, traits: [:connector]
  end

  factory :app_instance, class: MnoEnterprise::AppInstance do
    name do |a|
      a.app && a.app.name ? a.app.name : "MyTestAppInstance"
    end
    sequence(:uid) { |n| "app-int#{n}" }
    status "staged"
    billing_type 'monthly'
    association :owner, factory: :organization
    stack 'cube'
  end

  factory :organization, class: MnoEnterprise::Organization do
    sequence(:name) { |n| "organization_#{n}" }
    geo_country_code 'AU'
  end

  factory :invoice, class: MnoEnterprise::Invoice do
    sequence(:id) { |n| "inv-#{n}" }
    association :organization, factory: :organization
    started_at Time.utc(2011, 12, 25)
    ended_at Time.utc(2012, 01, 24)
    created_at Time.utc(2011, 12, 25)
    updated_at Time.utc(2011, 12, 26)
    billing_summary [{
                         name: 'bill_name',
                         label: 'bill_label',
                         app_uid: 'bill_app_uid',
                         lines: [{
                                     label: 'line_label',
                                     price: {
                                         cents: 100,
                                         currency: 'EUR'
                                     }
                                 }]
                     }]
  end

end
