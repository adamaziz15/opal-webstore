require 'rails_helper'

describe MnoEnterprise::TenantConfig do

  let(:tenant) { build(:tenant, frontend_config: {'foo' => 'bar'})}

  describe '.load_config!' do
    before { stub_api_v2(:get, '/tenant', tenant) }
    before { stub_api_v2(:get, '/apps', []) }
    subject { described_class.load_config! }

    it 'fetch the tenant config' do
      expect(described_class).to receive(:fetch_tenant_config)
      subject
    end

    it 'merge the settings' do
      subject
      expect(Settings.foo).to eq('bar')
    end

    it 'reconfigure mnoe' do
      expect(described_class).to receive(:reconfigure_mnoe!)
      subject
    end
  end
end
